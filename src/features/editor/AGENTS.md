# editor/ - 文稿编辑能力

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

<directory>
components/ - 编辑画布、工具栏、文稿信息、搜索、历史、资源、版本预览与编辑区右键菜单
components/document-properties/ - 文稿自定义属性定义、默认值、类型与破坏性变更确认
hooks/ - 编辑器图片、文稿功能栏与专注写作布局协调
model/ - CodeMirror extensions、Markdown、选区、光标、图片、剪贴板、快捷插入与文稿属性规则
</directory>

文稿功能栏的媒体、查找和历史版本视图共享同一标题行几何；媒体无图片时使用与文稿列表一致的居中图标空状态，避免不同 rail 的空内容层级和文案密度分裂。文稿列表右键菜单通过共享 tab 契约直达这三个视图，功能栏自身不复制第二套导航状态。

中文 IME、selection/cursor 和长文性能属于高风险边界。编辑器 model 保持可单测，React 组件只组合视图与事件；正常编辑继续使用浏览器原生选区，选区工具栏接管焦点时才由 `model/editorSelectionHighlight.ts` 临时绘制同一真实选区，不得为保留高亮而伪造编辑器焦点或改写 selection。

文本光标必须始终由浏览器原生绘制，只能通过 `caret-color` 表达颜色与显隐，禁止再用 CodeMirror `layer` 或任何 DOM 元素复刻 caret。自绘 caret 的位置来自 rAF 测量阶段，必然比同帧合成的文字晚一帧；平时无感，但中文 IME 组合期 preedit 每键都在变化，光标会持续滞后并在上屏瞬间跳位。行高带来的 caret 视觉高度属于排版议题，只能由排版解决，不得靠隐藏原生 caret 换取。同理，接管渲染可以，接管时序不行——凡是浏览器与输入法共同维护的实时反馈（caret、composition、拼写标记），一律不复刻。

打字机居中在 `view.composing` 期间必须完全让出滚动权：组合期每次 preedit 变化都算 docChanged，此时再发一次 `scrollIntoView` 只会与输入事务自带的滚动相互顶；组合结束的提交事务会照常触发居中，不会漏掉最终位置。

文稿大纲解析必须保持正文长度 O(N)：一次扫描同时产出标题、行号与源码 position，视图直接消费 position；禁止再为每个标题从正文开头重复计算 offset，避免标题密集型长文退化为 O(H×N)。

文稿大纲点击属于章节导航，不得沿用 CodeMirror 的 nearest 可见策略；目标标题应以视口顶部对齐并保留与编辑器初始排版一致的安全区，避免标题装饰越出视口，其他搜索、媒体等定位入口继续保持各自的默认滚动语义。

打字机模式必须使光标在文稿首行、中部和末行都能稳定居中：按当前 CodeMirror 视口高度计算上下可滚动空间，连续输入取消前一帧请求并只执行最新光标位置；关闭模式必须恢复编辑器原有 padding。入口归原生“视图”菜单，菜单点击只发出一次语义切换，renderer 以当前状态为事实来源取反后，再回写原生勾选状态。

普通编辑模式的文稿末尾必须保留可继续向上滚动的续写空间，底部 padding 按视口高度在 180–280px 之间自适应；不使用垂直 margin，也不与打字机模式的光标居中空间共用状态。

CodeMirror 是逐键输入的即时权威：热路径捕获持久 `Text` 快照和 revision，不在每个按键调用 `doc.toString()`；`model/documentChangeBuffer.ts` 只在 240ms idle / 1000ms max-delay 边界物化一次正文并提交 React 写作库模型，library 持久化队列仍在每次输入时独立排队并只在真正写盘时解析最新快照。CodeMirror session 必须隔离旁路 React 重渲染，目录正文解析只在输入暂停 400ms 后更新；切换文稿、预览或只读状态时必须 flush 缓冲，不得让关闭窗口时最后一笔输入停留在未排队状态。

普通 Markdown 文本区域的右键菜单由 `components/EditorContextMenu.tsx` 接管，只保留撤销、重做、剪切、复制、粘贴和全选，并在菜单打开时按当前 `EditorView` 的选区、只读态与历史深度决定可用状态；`model/editorClipboard.ts` 必须通过 CodeMirror 当前视图执行事务，文本粘贴继续走既有 `paste` 事件以保留图片导入扩展。图片预览 widget 自己阻止右键事件冒泡并继续使用图片专属菜单，不能被普通编辑菜单覆盖。

主动保存是低频显式边界，可以物化一次 CodeMirror 当前正文；开启“保存时进行中文排版优化”后先按现有五项规则转换该实时正文，再判断正文编辑或排版转换是否产生变化，并把变化结果作为手动历史版本与当前正文共同保存。后台自动保存永远不执行排版，也不生成版本；只有当前正文和排版结果都未变化时，重复 `⌘S` 才只 flush 待写队列。

同一 live 文稿 session 的 React CodeMirror `value` 只能作为稳定初始 seed，延迟模型提交属于本地 echo，绝不能作为受控旧值重新 dispatch 回编辑器；否则会删除更新输入并打断中文 IME composition。外部正文替换必须经显式同步路径进入 CodeMirror，文稿/历史版本 session 切换则建立新 seed。所有尚未确认的本地 echo 必须保留到 React 模型确认或 session 结束，不得用固定容量丢弃；模型确认较早 reader 时，只能删除同一 reader 及其之前的 pending snapshot，不得误删其后已经到达的新输入。

外部正文同步只允许改写拥有同一 `documentSessionKey` 的 EditorView；跨文稿 session 切换必须保留旧 EditorView 原文并由新 keyed session 直接消费新正文 seed，禁止先把新文稿全文 dispatch 到旧 EditorView。格式化等同 session 替换需要保留 selection 时，全文差异只计算一次并供所有 selection ranges 复用。

Markdown 阅读预览只能隐藏同一 live session 的 CodeMirror，不得卸载并用可能延迟的 React 正文重建 EditorView。排版、查找替换、AI 修改与历史恢复等覆盖性动作必须在执行瞬间读取 CodeMirror 或 pending reader 的最新正文，并先建立包含该实时正文的保护快照；搜索结果列表可以延迟刷新，但替换意图必须重新应用到最新正文。

编辑器 Markdown 组合键只保留粗体、斜体、链接与行内代码；标题、列表、任务和引用继续通过斜线菜单等显式入口调用格式化能力。编辑器行内格式契约由 `model/editorMarkdownLanguage.ts` 与装饰层共同实现：粗体 `**...**`、斜体 `*...*`、下划线 `~...~`、删除线 `~~...~~`、高亮 `==...==`；HTML `<mark>` 不属于正文格式协议，中文标点结尾的粗体紧接中文正文时仍需被识别。CodeMirror 默认的 `Mod-/` 注释动作必须排除，始终将该组合键交给应用切换快捷键面板。

斜线菜单的触发字符由 `shared/lib/slashTrigger.ts` 唯一定义，AI composer 复用同一边界，只有半角 `/`。编辑器不为中文输入法上屏的顿号 `、` 或全角 `／` 做等价或归一：顿号的标准键位是 `\`，在字符层把它与 `/` 等价会让顿号无法输入。

围栏代码由 Lezer `FencedCode` 节点驱动：整个代码块共享连续的块级背景和等宽排版，非编辑态收起开闭围栏，光标进入代码块后恢复原始 fence 与语言标记。CodeMirror 内容元素禁止使用垂直 margin 制造块间距，否则浏览器视觉位置会脱离编辑器高度映射并让后续任意正文点击偏移；间距应来自真实空行与可测量的内部 padding。行内代码只消费不改变行盒高度的 monospace highlight，不能与块级代码共用逐文本片段的视觉边界。

Markdown 分隔线在阅读态可隐藏 `---`、`***` 或 `___` 并绘制统一横线，但横线自身必须保持明确的指针命中入口；单击后先聚焦编辑器，再把 selection 放入原始标记并恢复源码。阅读态横线与源码态标记必须保持相同行盒高度，避免点击瞬间重排后让鼠标位置落入相邻行。

GFM 任务列表由 `TaskMarker` 派生可点击复选框，勾选动作只改写 Markdown 标记字符并保留正文；光标进入任务项后必须恢复完整 Markdown 标记，勾选图形不得参与 inline baseline 计算，避免状态切换造成纵向位移。普通无序列表不得在任务项前重复渲染圆点，源码显隐只能由光标或选区进入驱动，hover 不得临时暴露 marker。GFM `Table` 在阅读态用单一块级 widget 呈现真实行列边界，点击或键盘进入后恢复源码行；widget 与源码行均不得用垂直 margin 制造表格外间距，避免后续正文的视觉坐标脱离 CodeMirror 高度图。激活时必须先聚焦编辑器、再更新 selection，也不得在已经可见的表格切换时再次 `scrollIntoView` 引发视口跳动。表格识别必须来自语法树，不能回退到匹配竖线文本的正则状态机。全文表格装饰只在编辑命中已有表格、相邻行出现表格语法信号或选区进出表格时重建；普通正文输入只映射已有 DecorationSet，禁止逐键扫描整篇文稿。

脚注必须同时拥有正文引用与文末定义两种语义：阅读态把 `[^label]` 渲染为可点击上标，把 `[^label]:` 渲染为弱化脚注行；正文上标单击跳到对应定义，定义编号有正文引用时返回首次引用，没有引用时必须恢复本行 Markdown 源码。脚注区依靠文档真实空行分隔，不得自动绘制与 Markdown 分隔线相同却不可编辑的装饰线，也不得把大块顶部 padding 塞入定义行造成光标坐标偏移。

文稿系统元信息由 `model/documentProperties.ts` 与 `WritingSheet` 直接定义：标签、目标字数、`description` 与 `createdAt`/`updatedAt` 的实际值都由每篇文稿持有；属性面板可通过 app 注入的一次性 AI 摘要请求直接写入 `description`，发布前为空时由 publishing 预检补全；`updatedAt` 只由标题、正文等内容更新链路推进，属性、项目/分组归属、归档和发布状态变化保留原内容更新时间。文稿不持有“构思/完成”等系统状态，归档只由 `archivedAt` 表达。普通项目与收件箱的文稿属性定义都保留锁定的“目标字数”系统项，只允许设置以后新建文稿的创建默认值；普通项目从右键“文稿属性”设置，收件箱从“设置 → 写作 → 通用”设置。两者都不与文稿持续绑定，也不能批量覆盖已有文稿。作者新增的文稿属性按项目隔离并共享定义，但仍归文稿属性模型所有。

跨项目移动只消费目标项目自定义属性的默认值，并通过“仅为空值补齐”的公共规则保护文稿已有值；项目级“目标字数”创建默认值不得在移动时覆盖文稿目标。未被目标项目定义的旧属性继续随文稿持久化，不能因为目标视图暂不展示而删除。

AI 正文审阅在显示状态渲染 assistant 领域提供的最小差异块，在隐藏状态使用 baseBody 做只读修改前预览；优先使用 proposedBody 数字偏移，正文前部被继续编辑导致偏移漂移时，再用双侧上下文和最近位置重定位。删除线与新增色只表达已经解析出的 removed/added，不承担全文段落配对或事实修复。

AI 审阅空态不得安装 CodeMirror StateField；存在审阅时，远离审阅区与双侧锚点上下文的编辑只映射已有 DecorationSet 和 tracked range，不得逐键 `doc.toString()` 或重跑全文 diff。命中 tracked range 后才允许重新物化正文并执行权威重定位。

手动与 AI 图片插入只生成标准 Markdown；路径含空格或括号时使用尖括号 destination，不再读取应用级图片方言偏好。AI 批量图片插入必须先在纯文档字符串上顺序解析所有锚点，再以一次 CodeMirror transaction 替换最终正文；不得逐张 dispatch 后才发现后续锚点失效。任一图片或锚点校验失败时，编辑器正文保持原样，成功后也只形成一个撤销边界。

图片预览采用 CodeMirror StateField 驱动的节点选择，而不是临时 DOM class 或普通文字选区；选中变化只更新所在行的 Decoration class，不得把 `selected` 放入 Widget identity 后重建图片 DOM。图片 widget 的 identity 只表达外观，不得包含文档位置：`lineStart` 一旦进入 `eq`，上方任意输入都会让每张可见图片重新解码，因此行首必须在事件发生时由 `view.posAtDOM` 从实时视图解析。源码显隐与选中图片都已由 StateField 表达，图片装饰的重建条件不得再直接依赖 `selectionSet`，纯移动光标不能重扫视口每一行。单击预览后必须隐藏点击前的文字光标与选区，复制写入完整 Markdown 引用；剪切只删除整行 Markdown 引用但保留图片资源，保证后续粘贴仍可解析，Delete、Backspace 与右键删除才通知资源层清理，不得继续作用于旧文字光标。失效图片仍是可编辑的 Markdown 引用：错误占位必须保留源码按钮、右键菜单与选中能力，单击后展开源码并允许键盘删除，不能用不可交互的错误文本覆盖引用。远程 HTTP(S) 引用不得直接放宽 WebView CSP，而应复用原生受限下载与格式校验，在临时目录转换为 renderer 可读资源；删除远程引用不得触发本地孤儿资源清理。引用删除后先持久化最新文稿，再交给原生资源层复核全库、历史版本与回收站引用；只有确认无引用的 `assets/images` 文件才可移入落笔废纸篓。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
