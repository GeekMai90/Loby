# editor/ - 文稿编辑能力

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

<directory>
components/ - 编辑画布、工具栏、文稿信息、搜索、历史、资源与版本预览
hooks/ - 编辑器图片与文稿功能栏模式协调
model/ - CodeMirror extensions、Markdown、选区、光标、图片、快捷插入与文稿属性规则
</directory>

中文 IME、selection/cursor 和长文性能属于高风险边界。编辑器 model 保持可单测，React 组件只组合视图与事件；未有定向回归证据时继续使用浏览器原生选区。

图片预览的选中状态属于 CodeMirror 状态而非临时 DOM class；Delete、Backspace、右键删除与剪切共用整行引用删除语义。引用删除后先持久化最新文稿，再交给原生资源层复核全库、历史版本与回收站引用；只有确认无引用的 `assets/images` 文件才可移入落笔废纸篓。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
