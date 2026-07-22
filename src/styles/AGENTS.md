# styles/ - renderer 样式所有权

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

成员按界面责任命名：`base.css` 与 `themes.css` 管全局基础；`shell.css` 管窗口几何；`editor*.css` 管 CodeMirror；`ai*.css` 管 AI 明确例外；`publishing*.css`、`settings*.css`、`library*.css` 管各自复杂表面；其余文件只服务名称对应的单一界面。

普通布局和控件状态优先 Tailwind/shadcn。新增 stylesheet 前先确认现有责任边界不能容纳，`src/styles.css` 永远只做 import entrypoint。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
