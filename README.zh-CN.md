# ARC Hover Sidebar

给 Obsidian 做一个像 ARC 浏览器那样的侧边栏：**鼠标扫到窗口左边缘，侧栏滑出；往右划走，侧栏收回。**

## 演示

[▶ 观看演示视频](media/demo.mp4) —— 鼠标划到左边缘侧栏滑出，往右划出右边界侧栏收回。

## 它做什么

| 侧栏怎么打开的 | 怎么关闭 |
| --- | --- |
| 鼠标划到窗口左边缘（`edgeZone` 内，默认 5px）自动滑出 | 鼠标横向越过侧栏右边界即收起 |
| 快捷键 / 按钮手动打开，且「统一开合方式」开着 | 鼠标滑到侧栏上后再滑出去才关闭（鼠标在侧栏外可自由活动，不会一动就收起） |
| 快捷键 / 按钮手动打开，「统一开合方式」关着 | 不自动关，由你自己关 |

侧栏用 Obsidian 原生 `leftSplit.expand()` / `collapse()` 展开收起 —— 不是 CSS 伪装，所以宽度、配色、内容布局和你手动打开时完全一致。

另外把主题自带的「悬停显示功能区」也接过来用（主题文件保持原版不动，只覆盖一个 CSS 变量）。

## 安装

手动安装：

1. 下载本仓库的 `main.js` 与 `manifest.json`；
2. 放进你的 vault 里的 `<vault>/.obsidian/plugins/arc-hover-sidebar/`；
3. 在 vault 的 `.obsidian/community-plugins.json` 里加入 `"arc-hover-sidebar"`；
4. 重新加载 Obsidian，在「设置 → 第三方插件」中启用它。

也可以用 [BRAT](https://github.com/TomG777/obsidian-brat) 安装：在 BRAT 里添加 `https://github.com/goodends/arc-hover-sidebar`。

## 设置

设置 → 第三方插件 → ARC Hover Sidebar：

- **启用悬停侧栏** —— 总开关。关闭后插件完全不再干预侧边栏。
- **统一开合方式** —— 开启后，用户自己打开的侧栏也由插件接管，关闭方式统一为「横向划出侧栏右边界」。
- **同步功能区** —— 开启后，功能区（左侧图标栏）与侧边栏同时隐藏、同时展开。

## 可调参数（`main.js` 顶部与 getter）

| 参数 | 默认 | 含义 |
| --- | --- | --- |
| `edgeZone` | 5px | 侧栏边缘触发区宽度 |
| `ribbonTrigger` | 24px | 功能区触发带宽度（覆盖主题的 `--hover-sidedock-trigger-area`） |
| `panelRight()` | 右边界 +30px | 判定「鼠标已滑出侧栏」的阈值，留 30px 余量方便拖拽把手 |

## 实现要点

- **触发判定只有两条纯几何条件**，不看速度（与 ARC 一致）：
  - 位置：鼠标进入窗口最左 `edgeZone` 像素
  - 路径：本帧向左移动且移动路径经过该热区（覆盖一帧跨过热区的情况）
- **单例保护**：加载时若发现旧实例残留，先卸载它。两个实例同时操作侧栏会让它反复开关（表现为闪烁）。
- **冷启动保护**：`leftSplit` 在布局就绪前不存在，`onload` 里不能直接读 `.collapsed`，否则插件加载失败。
- **轮询兜底**：`expand()` / `collapse()` 是异步生效的，展开完成前后可能不再有事件，用 400ms 轮询保证状态同步。
- **拖拽保护**：拖动侧栏宽度把手期间不收起，否则宽度根本调不了。
- **失焦保护**：窗口切到别的软件时收起侧栏，失焦期间不再响应悬停展开。

## 已知取舍

- 热区意味着鼠标只要在窗口左侧 `edgeZone` 内移动就会弹出侧栏。如果只是想去点功能区图标，侧栏会跟着冒出来 —— 调小 `edgeZone` 即可。
- 触发区变大后，鼠标在左侧快速划过更容易误触发：这是热区与灵敏度之间的权衡。
- 仅桌面端可用（`isDesktopOnly: true`）。

## 开发

没有构建步骤，`main.js` 就是全部逻辑。本地开发时把仓库里的 `main.js` / `manifest.json` 软链接到 `<vault>/.obsidian/plugins/arc-hover-sidebar/` 即可，改完在 Obsidian 里 disable → enable 插件生效。

开发约定见 [CLAUDE.md](CLAUDE.md)。

## 许可证

[MIT](LICENSE)
