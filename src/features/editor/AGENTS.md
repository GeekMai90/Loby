# editor/ - 文稿编辑能力

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

<directory>
components/ - 编辑画布、工具栏、文稿信息、搜索、历史、资源与版本预览
components/document-properties/ - 文稿自定义属性定义、默认值、类型与破坏性变更确认
hooks/ - 编辑器图片、文稿功能栏与专注写作布局协调
model/ - CodeMirror extensions、Markdown、选区、光标、图片、快捷插入与文稿属性规则
</directory>

中文 IME、selection/cursor 和长文性能属于高风险边界。编辑器 model 保持可单测，React 组件只组合视图与事件；未有定向回归证据时继续使用浏览器原生选区。

文稿系统元信息由 `model/documentProperties.ts` 与 `WritingSheet` 直接定义：状态、标签、目标字数、摘要与创建/更新时间不写入自定义属性定义，创建/更新时间由统一文稿创建和更新链路维护。作者新增的文稿属性按项目隔离并共享定义，但仍归文稿属性模型所有；项目设置不能批量覆盖每篇文稿自己的目标。

跨项目移动只消费目标项目自定义属性的默认值，并通过“仅为空值补齐”的公共规则保护文稿已有值；未被目标项目定义的旧属性继续随文稿持久化，不能因为目标视图暂不展示而删除。

AI 正文审阅只渲染 assistant 领域提供的最小差异块；优先使用 proposedBody 数字偏移，正文前部被继续编辑导致偏移漂移时，再用双侧上下文和最近位置重定位。删除线与新增色只表达已经解析出的 removed/added，不承担全文段落配对或事实修复。

图片预览的选中状态属于 CodeMirror 状态而非临时 DOM class；Delete、Backspace、右键删除与剪切共用整行引用删除语义。引用删除后先持久化最新文稿，再交给原生资源层复核全库、历史版本与回收站引用；只有确认无引用的 `assets/images` 文件才可移入落笔废纸篓。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
