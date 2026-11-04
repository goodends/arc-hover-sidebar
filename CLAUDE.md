# CLAUDE.md — obsidian-arc-sidebar

Obsidian 插件：像 ARC 浏览器一样，鼠标扫到窗口左边缘滑出侧边栏。

## 这是什么

一个只有两个文件的 Obsidian 插件：

| 文件 | 作用 |
| --- | --- |
| `main.js` | 全部逻辑：鼠标追踪、侧栏展开/收起、设置面板、注入的 CSS |
| `manifest.json` | 插件元信息 |

## 运行方式

没有构建步骤。代码直接在 `~/Workspace/.obsidian/plugins/arc-hover-sidebar/` 通过**软链接**加载：

```
~/.obsidian/plugins/arc-hover-sidebar/main.js      -> ~/Code/obsidian-arc-sidebar/main.js
~/.obsidian/plugins/arc-hover-sidebar/manifest.json -> ~/Code/obsidian-arc-sidebar/manifest.json
```

改完代码在 Obsidian 里执行 `obsidian plugin:reload id=arc-hover-sidebar` 即可生效。
（注意：用 `plugin:reload` 热重载会残留旧实例并造成闪烁，调试时改用 disable → enable。）

## 修改时注意

1. **不要用 CSS 伪装侧栏**。必须用 `app.workspace.leftSplit.expand()` / `collapse()`，
   否则与 Obsidian 自身的展开状态打架（用户按快捷键开侧栏时会闪一下）。
2. **`onload` 里不能直接读 `app.workspace.leftSplit.collapsed`** —— 冷启动时
   `leftSplit` 尚不存在，会抛异常导致插件加载失败。
3. **`expand()` / `collapse()` 是异步生效的**，完成前后可能不再有 layout-change 事件，
   状态同步要靠 `main.js` 里那个 400ms 的轮询兜底。
4. **热区参数**在 `main.js` 的 `edgeZone` / `ribbonTrigger` getter 里，
   插件只覆盖 `--hover-sidedock-trigger-area` 这一个 CSS 变量，**不改主题文件**。
5. **Cupertino 主题保持原版**（`~/Workspace/.obsidian/themes/Cupertino/`），升级主题后若有冲突，
   在插件里覆盖变量，而不是去改主题。

## 依赖

- Obsidian ≥ 1.0（用到了 `PluginSettingTab`、`Setting`）
- 桌面端专用（`isDesktopOnly: true`）

## 相关

- 知识库侧笔记：`~/Workspace/Projects/obsidian-arc-sidebar/README.md`
- 记忆：`~/.claude/projects/-Users-suoyuanxi-Code-obsidian-arc-sidebar/memory/`
