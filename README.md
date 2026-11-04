# ARC Hover Sidebar

给 Obsidian 做一个像 ARC 浏览器那样的侧边栏：**鼠标扫到窗口左边缘，侧栏滑出；往右划走，侧栏收回。**

## 它做什么

| 侧栏怎么打开的 | 怎么关闭 |
| --- | --- |
| 鼠标划到窗口左边缘（40px 内）自动滑出 | 鼠标横向越过侧栏右边界即收起 |
| 快捷键 / 按钮手动打开，且「统一开合方式」开着 | 滑到侧栏上、再滑出去才关闭（鼠标在侧栏外可自由活动） |
| 快捷键 / 按钮手动打开，「统一开合方式」关着 | 不自动关，由你自己关 |

侧栏用 Obsidian 原生 `leftSplit.expand()` / `collapse()` 展开收起 —— 不是 CSS 伪装，所以宽度、配色、内容布局和你手动打开时完全一致。

另外把主题自带的「悬停显示功能区」也接过来用（主题文件保持原版不动，只覆盖一个 CSS 变量）。

## 安装

代码在 `~/Code/obsidian-arc-sidebar/`，Obsidian 里通过软链接加载：

```bash
cd ~/Workspace/.obsidian/plugins/arc-hover-sidebar
ln -s ~/Code/obsidian-arc-sidebar/main.js main.js
ln -s ~/Code/obsidian-arc-sidebar/manifest.json manifest.json
```

并在 `~/Workspace/.obsidian/community-plugins.json` 里登记 `arc-hover-sidebar`。

## 设置

设置 → 第三方插件 → ARC Hover Sidebar：

- **统一开合方式** —— 开启后，用户自己打开的侧栏也由插件接管（关闭方式统一为「滑到侧栏上再滑出」）。

## 可调参数（`main.js` 顶部与 getter）

| 参数 | 默认 | 含义 |
| --- | --- | --- |
| `edgeZone` | 40px | 侧栏边缘触发区宽度 |
| `ribbonTrigger` | 24px | 功能区触发带宽度（覆盖主题的 `--hover-sidedock-trigger-area`） |
| `panelRight()` | 右边界 +12px | 判定「鼠标已滑出侧栏」的阈值，留 12px 余量方便拖拽把手 |

## 实现要点

- **触发判定只有两条纯几何条件**，不看速度（与 ARC 一致）：
  - 位置：鼠标进入窗口最左 `edgeZone` 像素
  - 路径：本帧向左移动且移动路径经过该热区（覆盖一帧跨过热区的情况）
- **单例保护**：加载时若发现旧实例残留，先卸载它。两个实例同时操作侧栏会让它反复开关（表现为闪烁）。
- **冷启动保护**：`leftSplit` 在布局就绪前不存在，`onload` 里不能直接读 `.collapsed`，否则插件加载失败。
- **轮询兜底**：`expand()` / `collapse()` 是异步生效的，展开完成前后可能不再有事件，用 400ms 轮询保证状态同步。
- **拖拽保护**：拖动侧栏宽度把手期间不收起，否则宽度根本调不了。

## 已知取舍

- 侧栏热区 40px 意味着鼠标只要在窗口左侧 40px 内移动就会弹出侧栏。如果只是想去点功能区图标，侧栏会跟着冒出来 —— 调小 `edgeZone` 即可。
- 触发区变大后，鼠标在左侧快速划过更容易误触发：这是热区与灵敏度之间的权衡。

## 相关

- 主题 Cupertino 的本地副本在 `~/Workspace/.obsidian/themes/Cupertino/`，**保持原版未改**。
- 知识库侧的项目笔记：`~/Workspace/Projects/obsidian-arc-sidebar/README.md`
