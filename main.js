const { Plugin, PluginSettingTab, Setting } = require('obsidian');

const DEFAULTS = {
	// 统一开合方式：侧栏无论怎么打开的，都由本插件接管
	// （鼠标划到左边缘打开，横向划出右边界关闭）
	takeover: false,
	// 同步功能区：功能区随侧边栏一起显隐（同时隐藏、同时展开）
	syncRibbon: false,
};

module.exports = class ArcHoverSidebar extends Plugin {
	async onload() {
		await this.loadSettings();

		// 单例保护：热重载若残留了旧实例，先把它卸掉。
		// 两个实例同时操作侧栏会让它反复开关（表现为闪烁）。
		if (window.__arcHoverSidebar && window.__arcHoverSidebar.owner !== this) {
			try {
				window.__arcHoverSidebar.owner.unload();
			} catch (e) {
				console.error('arc-hover-sidebar: 卸载旧实例失败', e);
			}
		}
		window.__arcHoverSidebar = { owner: this };

		// pinned：当前处于「悬浮展开」状态
		// expandedByUs：这个展开是我们触发的（而非用户自己打开的）
		this.pinned = false;
		this.expandedByUs = false;
		this.prevX = null;
		this.dragging = false;
		// 冷启动时 layout 尚未就绪，leftSplit 可能还不存在，
		// 所以这里只置空，等 onLayoutReady 再取值
		this.lastCollapsed = null;
		// 是否由鼠标划过左边缘触发展开。
		// 是 → 沿用「横向越过右边界即收起」
		// 否（用户用快捷键/按钮打开后被接管）→ 「滑到侧栏上再滑出」才收起
		this.byHover = false;
		// 指针是否在侧栏区域内（'in' / 'out'，null 表示还没判断过）
		this.pointerSide = null;
		// 是否完成过一次「从侧栏外滑回侧栏上」的动作。
		// 只有完成这个来回，之后再滑出侧栏才会关闭侧栏。
		this.armed = false;

		this.injectStyles();
		this.applyRibbonState();

		this.registerDomEvent(document, 'mousemove', (e) => this.handleMove(e));
		// 正在拖动侧栏宽度时不要收起，否则根本没法调整宽度
		this.registerDomEvent(document, 'mousedown', (e) => {
			const t = e.target;
			const onHandle = t && t.closest && t.closest('.workspace-leaf-resize-handle');
			const nearEdge = Math.abs(e.clientX - this.rawRight()) <= 10;
			if (onHandle || nearEdge) {
				this.dragging = true;
			}
		});
		this.registerDomEvent(document, 'mouseup', () => {
			this.dragging = false;
		});
		this.registerEvent(this.app.workspace.on('layout-change', () => this.sync()));
		// expand()/collapse() 是异步生效的，展开完成前后可能不再有事件，
		// 用一个轻量轮询兜底，保证状态总能被同步到
		this.syncTimer = window.setInterval(() => this.sync(), 400);
		this.app.workspace.onLayoutReady(() => {
			const split = this.app.workspace.leftSplit;
			if (split) this.lastCollapsed = split.collapsed;
			this.sync();
		});

		this.addSettingTab(new ArcHoverSidebarSettingTab(this.app, this));
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULTS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	onunload() {
		if (window.__arcHoverSidebar && window.__arcHoverSidebar.owner === this) {
			delete window.__arcHoverSidebar;
		}
		if (this.syncTimer) {
			window.clearInterval(this.syncTimer);
			this.syncTimer = null;
		}
		// 退出时不要留下「展开」状态
		const split = this.app.workspace && this.app.workspace.leftSplit;
		if (this.expandedByUs && split) {
			this.expandedByUs = false;
			split.collapse();
		}
		this.pinned = false;
		this.removeStyles();
	}

	// 边缘触发区宽度：鼠标扫到窗口最左侧这么多像素即展开侧栏
	get edgeZone() {
		return 40;
	}

	// 功能区（左侧图标栏）的触发带宽度，与主题的「悬停显示功能区」共用
	get ribbonTrigger() {
		return 24;
	}

	// 只覆盖主题的触发区宽度，功能区本身仍由主题的「悬停显示功能区」实现，
	// 这样不必改动主题文件。
	injectStyles() {
		this.styleEl = document.createElement('style');
		this.styleEl.id = 'arc-hover-sidebar-style';
		this.styleEl.textContent = `
body:not(.is-mobile) {
  --hover-sidedock-trigger-area: ${this.ribbonTrigger}px;
}
/* 同步功能区：功能区的 is-collapsed 类由 Obsidian 在侧栏收起/展开时
   同步设置（leftRibbon.setCollapsedState），所以直接跟随它即可，
   不需要逐帧监听。动画参数与 Obsidian 侧栏保持一致（140ms / swing），
   这样两者看起来是同时展开、同时收起。 */
body.arc-sync-ribbon .workspace-ribbon.mod-primary {
  transition:
    width 140ms var(--anim-motion-swing),
    flex-basis 140ms var(--anim-motion-swing),
    padding 140ms var(--anim-motion-swing),
    border-inline-end-width 140ms var(--anim-motion-swing) !important;
  overflow: hidden;
}
/* 收起时宽度归零。内边距和边框也要一并去掉，
   否则会残留一条细边（box-sizing 下 padding 会撑出宽度）。 */
body.arc-sync-ribbon .workspace-ribbon.mod-primary.is-collapsed {
  width: 0 !important;
  flex: 0 0 0 !important;
  padding: 0 !important;
  border-inline-end-width: 0 !important;
}
/* 功能区收起后，Obsidian 仍按 --ribbon-width（44px）计算给 macOS 交通灯
   让位的空间（--frame-left-space: 80px - ribbon 宽），
   于是「打开侧边栏」按钮会压在交通灯上。
   这里把 --ribbon-width 一并归零，和 Obsidian 原生隐藏功能区时的布局一致，
   让按钮回到交通灯右侧。 */
body.arc-sync-ribbon:has(.workspace-ribbon.mod-primary.is-collapsed) {
  --ribbon-width: 0px;
}
/* --ribbon-width 变化会让标签栏头部的内边距跳变，
   补一个过渡，避免按钮在展开/收起瞬间瞬移 */
body.arc-sync-ribbon .workspace-tab-header-container {
  transition: padding-inline-start 140ms var(--anim-motion-swing);
}
`;
		document.head.appendChild(this.styleEl);
	}

	// 功能区（左侧图标栏）的显隐。
	// 功能区没有官方 API 能单独控制（Obsidian 只提供全局的「显示功能区」配置），
	// 但 Obsidian 会在侧栏收起/展开时同步给功能区加/减 is-collapsed 类，
	// 显隐逻辑交给 CSS 跟随该类即可，插件只需开关一个 body 上的标记。
	applyRibbonState() {
		document.body.classList.toggle('arc-sync-ribbon', !!this.settings.syncRibbon);
	}

	removeStyles() {
		if (this.styleEl) {
			this.styleEl.remove();
			this.styleEl = null;
		}
		// 别把「同步功能区」的状态留给下一次启动
		document.body.classList.remove('arc-sync-ribbon');
	}

	handleMove(e) {
		const x = e.clientX;
		const split = this.app.workspace.leftSplit;

		// 布局尚未就绪时 leftSplit 还不存在
		if (!split) return;

		// 正在拖动侧栏宽度：保持展开，让用户能自由调整
		if (this.dragging) {
			this.prevX = x;
			return;
		}

		const prev = this.prevX === null ? x : this.prevX;

		// 记录指针在侧栏内还是外（只对「用户打开后被接管」的侧栏有意义）：
		//   从侧栏外滑回侧栏上 → armed（完成一次「进入」）
		//   此后再滑出侧栏 → 才关闭
		// 这样鼠标在侧栏外的区域可以自由活动，不会一动就收起。
		const right = this.rawRight();
		if (!this.byHover) {
			if (x <= right) {
				if (this.pointerSide === 'out') this.armed = true;
				this.pointerSide = 'in';
			} else {
				this.pointerSide = 'out';
			}
		}

		if (!this.pinned) {
			// 侧栏已经是打开状态时（用户自己打开的），不接管，避免把它误关
			if (!split.collapsed) return;
			// 快速划过时一帧可能直接跨过热区，所以按"路径"判断：
			// 本帧向左移动且路径经过热区，即视为进入
			const crossed =
				prev > x && Math.min(prev, x) <= this.edgeZone && Math.max(prev, x) >= 0;
			if (x <= this.edgeZone || crossed) {
				this.pinned = true;
				this.expandedByUs = true;
				this.byHover = true;
				this.pointerSide = 'in';
				this.armed = false;
				split.expand();
			}
		} else if (x > this.panelRight()) {
			// 越界是否收起，取决于侧栏是怎么打开的：
			//   划左边缘打开的 → 直接收起
			//   快捷键打开的   → 需要「滑到侧栏上再滑出」这一来回
			const shouldClose = this.byHover || this.armed;
			if (!shouldClose) {
				this.prevX = x;
				return;
			}
			this.pinned = false;
			this.armed = false;
			this.byHover = false;
			if (this.expandedByUs) {
				this.expandedByUs = false;
				split.collapse();
			}
		}
		this.prevX = x;
	}

	// 与 Obsidian 自身的展开/收起保持同步：
	// 用户自己打开侧栏（快捷键、按钮）后，就不再自动收起，交还控制权
	sync() {
		const split = this.app.workspace.leftSplit;
		if (!split) return;
		const collapsed = split.collapsed;

		// 首次拿到真实状态，只记录不判定
		if (this.lastCollapsed === null) {
			this.lastCollapsed = collapsed;
			return;
		}

		// 状态没有变化就不处理。
		// 关键：expand() 是异步生效的，展开过程中也会触发 layout-change，
		// 那时 collapsed 仍为 true，若不比较就会误判成「侧栏被关掉了」。
		if (collapsed === this.lastCollapsed) return;
		this.lastCollapsed = collapsed;

		if (this.pinned && this.expandedByUs && collapsed) {
			// 我们展开的侧栏被关掉了（用户主动关）→ 交还控制权
			this.pinned = false;
			this.expandedByUs = false;
		} else if (!collapsed && !this.expandedByUs) {
			// 用户自己打开了侧栏
			if (this.settings.takeover) {
				// 「统一开合方式」开启：也由本插件接管，
				// 之后按「滑到侧栏上再滑出」的方式关闭
				this.pinned = true;
				this.expandedByUs = true;
				this.byHover = false;
				this.pointerSide = null;
				this.armed = false;
			} else {
				// 默认不管：用户自己开的侧栏保持展开，不被自动收起
				this.pinned = false;
			}
		}
	}

	panelWidth() {
		const split = this.app.workspace.leftSplit;
		const size = split && split.size;
		if (size && size > 0) return size;
		return 320;
	}

	// 侧栏右边界（屏幕坐标）
	rawRight() {
		const el = document.querySelector('.mod-primary-split');
		if (el) {
			const r = el.getBoundingClientRect();
			if (r.width > 0) return r.right;
		}
		return this.panelWidth();
	}

	// 侧栏右边界 + 一点余量，
	// 让鼠标停在把手附近时不会立刻收起，方便拖拽调整宽度
	panelRight() {
		return this.rawRight() + 12;
	}
};

class ArcHoverSidebarSettingTab extends PluginSettingTab {
	constructor(app, plugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display() {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('统一开合方式')
			.setDesc(
				'开启后侧边栏一律由本插件管理：无论它是被快捷键、按钮打开，还是鼠标划到左边缘打开，' +
					'关闭方式都统一为「鼠标横向划出侧栏右边界」。关闭时则保持现状：' +
					'你手动打开的侧栏不会被自动收起。'
			)
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.takeover).onChange(async (value) => {
					this.plugin.settings.takeover = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('同步功能区')
			.setDesc(
				'开启后，功能区（左侧图标栏）与侧边栏同时隐藏、同时展开：' +
					'侧边栏收起时功能区一并隐藏，鼠标划到左边缘展开侧边栏时功能区也一起出现。'
			)
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.syncRibbon).onChange(async (value) => {
					this.plugin.settings.syncRibbon = value;
					await this.plugin.saveSettings();
					this.plugin.applyRibbonState();
				})
			);
	}
}
