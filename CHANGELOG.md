# Changelog

All notable changes to Loby should be recorded here.

This project uses a pragmatic changelog format while it is still pre-release.

## Unreleased

- 修复 macOS 顶部工具栏双击最大化被重复处理的问题，避免窗口先还原又立即最大化；主窗口拖拽与普通窗口/最大化切换恢复为一次动作。
- 主窗口现在会记住上次关闭时的尺寸、位置和最大化状态；首次启动仍保持默认最大化，窗口状态写入当前用户 app-config，不进入写作库。
- 为主窗口显示增加原生侧兜底：renderer 的首屏就绪信号跑在隐藏 WebView 里，一旦被系统挂起或异常中断，窗口过去会永远隐藏、应用完全不可用；现在原生层会在等待上限后自行显示窗口。
- 主窗口与公众号主题工作室窗口恢复不透明，窗口层底色跟随当前主题：消除启动时先露出透明窗口的观感，并去掉 macOS 上因窗口透明导致的逐帧全窗口重合成开销（静态界面下 GPU 功耗约为不透明窗口的八倍）。窗口外沿的圆角与描边交回系统绘制。
- 随之移除 `macOSPrivateApi` 与 `macos-private-api` feature，应用不再依赖 macOS 私有 API。

## 0.3.4 - 2026-08-03

- 将编辑器普通文本区域的原生右键菜单替换为与 Loby 一致的菜单，保留撤销、重做、剪切、复制、粘贴和全选；图片预览继续使用专属菜单，并保留文本与图片粘贴入口。

## 0.3.3 - 2026-08-02

- 修复项目导航和文稿切换时编辑器正文与选区被重置的问题，并避免仅元数据变化干扰文稿内容排序。
- 修复编辑器剪切图片时误清理图片资源导致粘贴后无法加载的问题；Delete、Backspace 和右键删除仍保持资源清理行为。
- 修复多选文稿移动链路，并在项目详情中正确显示文稿所属分组。
- 优化连续输入时图片预览 widget 的稳定性与 Markdown 视口装饰更新，减少无效重建和布局开销。

## 0.3.2 - 2026-08-02

- 优化编辑器连续输入流畅度：隐藏的写作统计不再扫描正文，字数与项目进度按文稿 revision 复用，目录在停笔后低频更新，并隔离 CodeMirror 的无意义 React 重渲染；逐键保存排队、切换与关闭时 flush 等可靠性边界保持不变。

## 0.3.1 - 2026-08-01

- 修复正式安装版启动 AI 助手时因 renderer 缺少 `localDirectoryPaths` 参数而被 Tauri 拒绝的问题；普通对话显式传递空目录范围，只有用户明确提供的本地目录才进入 `read_local_directory` 只读授权。

## 0.3.0 - 2026-08-01

- 增加文稿置顶：文稿卡片右键可置顶或取消置顶，置顶状态随 Markdown 元数据持久化，并在跨项目列表中保持统一排序与标记。

- 优化 AI 助手附件与会话标题：附件输入统一为受管的本地引用，会话标题可根据首轮内容生成并持久化，主助手与公众号主题助手共享一致的对话展示规则。

- 统一主 AI 助手与公众号主题助手的运行时、模型选择和主题修改流程，主题助手以结构化局部变更交由落笔校验、合并、保存与撤销，并强化本地路径和敏感数据边界。

- 统一浮层阴影层级：Dialog、菜单、Tooltip 等浮动界面使用共享的多层 elevation Token，提升明暗主题下的层级辨识度。

- 拆分两种文稿搜索快捷键：`Command + P` 保持为写作库全局全文搜索，列表栏顶部的当前列表筛选改用 `Command + Shift + P`，并同步按钮提示与无障碍快捷键声明。

- 修复 AI 助手默认模型与思考强度被当前对话或不完整模型目录覆盖的问题：设置中的默认值保持持久化，新建对话从默认值初始化，主题助手的临时模型选择不再回写全局设置。

- 增加文稿列表右键批量删除：多选文稿后可一次性移入废纸篓，并保留后续恢复能力。

- 优化本地全文搜索索引更新：单文稿保存与外部 Markdown 变化优先走路径级增量同步，查询不再对每次输入重复扫描整个写作库；无法完整应用的路径仍会回退到全量校验。

## 0.2.0 - 2026-07-31

- 功能版发布：新增基于本地全文索引的 Markdown 文章搜索模态窗，支持标题与正文搜索、Enter 打开、Command/Ctrl+Enter 进入项目定位，以及鼠标修饰键点击。
- 优化文稿列表性能：引入虚拟化列表，减少大量文章下的 DOM 挂载与滚动开销，并移除列表滚动时的逐行动画。
- 优化搜索结果展示：列表搜索会定位到正文命中行并在卡片中高亮标题与正文关键词；全局搜索摘要过滤 Markdown 图片引用，并将命中词保持在可见区域。

## 0.1.3 - 2026-07-31

- 修订版发布：验证应用版本同步、签名 updater 包和 GitHub Release 更新清单流程。

## 0.1.2 - 2026-07-31

- 完善应用更新流程：更新卡片在同一个按钮内展示下载进度，下载完成后由用户点击“重启安装”；新增设计系统状态样例，并将帮助菜单的“新功能”和“帮助”接入帮助中心网页。

- 将源码仓库、本地项目目录与 CLI repository 元数据统一为 `Loby`，并移除主题兼容提示中残留的旧品牌展示；历史文稿和公众号主题所需的旧命名空间仍保留为只读迁移输入。

- 增加文稿收藏：文稿卡片右键可收藏或取消收藏，一级导航在收件箱下方新增跨项目“收藏”筛选；收藏状态随 Markdown 元数据持久化，不创建文件夹、不移动文稿，也不改变正文更新时间。

- 文稿列表改用动态测量的虚拟窗口，只挂载视口附近的卡片；大量文稿下仍保留搜索、排序、多选、右键与拖拽语义，同时取消逐行滚动入退场动画。

- 将 GitHub 发布统一为项目绑定的通用适配器架构：设置中可创建 Hugo 博客或 Starlight 文档站目标，项目只保存稳定 target ID，并仅显示自身绑定目标的发布入口；Starlight 继续支持分组目录映射、单篇与整项目同步，旧博客/帮助中心配置和发布记录会幂等迁移为普通目标实例。

- 将系统菜单中的英文“About 落笔”替换为中文“关于落笔”，继续使用无加载闪烁的系统 About 面板，并显式传入适合该面板尺寸的落笔应用图标、真实包版本和“版权所有 麦先生”元数据。

- 精简设置导航：删除只展示硬编码版本、内部定位和技术框架的“关于”分类，应用真实版本继续由系统“关于落笔”菜单承载；首项“外观”改名为“通用”并换用通用设置图标，内部仍保留原有“应用主题”选择与持久化行为。

- 精简“设置 → 文件与存储”：移除项目数量、恢复状态和文稿索引说明，将目录操作拆分为当前写作文件夹、带确认的整库移动与保留原目录的切换；切换时可直接打开已有落笔目录，也可初始化用户选择的空文件夹，带普通内容的非落笔目录仍会被拒绝。

- GitHub 发布目标 registry 改为空仓库起步：连接 GitHub 后固定显示“添加 GitHub 发布目标”，只有用户从菜单选择“麦先生说博客（自用）”并保存后才生成实例行，旧版未配置占位会自动清理而真实历史配置继续保留；博客设置 Dialog 同步移除重复说明小字，字段标题和输入值恢复主文字色。

- 将墨问更多菜单中的“替换 API Key”改为“设置 API Key”，设置 Dialog 统一使用“设置墨问 API Key”并移除可见说明；已保存凭证只显示掩码占位，小眼睛仅控制当前新输入草稿的显隐，不把原生 secret 明文回填到 renderer。

- GitHub 发布目标进入设置时不再自动访问网络验证账号和仓库：目录根据本地已保存凭证即时显示，只有用户主动“立即刷新”、打开仓库设置或真正发布时才访问 GitHub；手动刷新遇到临时网络失败会保留已添加状态，不再让发布目标从列表中消失。

- 重构“设置 → 发布”为两级同构目录：首层“发布目标”只列出已添加的 GitHub/墨问渠道并把刷新、权限、验证、凭证替换和移除收进更多菜单；GitHub 接入后才显示按目标名称排列的“GitHub 发布目标”，具体仓库参数继续在独立 Dialog 编辑。AI 助手连接列表同步改用共享的 12px 内缩浅色分割线，不再保留连接外框的整行 border。

- 优化设置卡片层级：具体设置项之间的分割线改为左右各留 12px 空隙的断开样式，并使用浅于区块外框的独立语义色，明暗主题保持一致的层级关系。

- 恢复项目右键“文稿属性”中的系统属性“目标字数”，并在“设置 → 写作 → 通用”增加“收件箱默认目标字数”：普通项目和项目之外的新文稿分别继承各自默认值，创建后文稿目标保持独立；这些默认值不参与项目总字数/总篇数目标，也不回写已有文稿或跨项目移动的文稿。写作设置的首个分组同步由“编辑器”更名为更准确的“通用”。

- 移除写作设置中的“图片引用”方言选项；手动插图、AI 单图/批量插图、导入改写和 Markdown bundle 导出现在统一写入标准 Markdown，对已有 Obsidian embed 继续提供读取、预览、移动与导入兼容且不静默改写旧文稿；含空格或括号的图片路径使用标准尖括号 destination。

- 将写作设置中的“字体”Select 按钮改为内容自适应，并继续使用共享的完整内容宽度弹层与右对齐定位，避免按钮留白和菜单选项截断。

- 将写作设置中的“Markdown 排版”更名为“Markdown 中文排版优化”，并在“通用”分组新增默认关闭的“保存时进行中文排版优化”；`Command + S` 现在读取编辑器实时正文，在正文相对上次手动保存发生变化或启用的中文排版规则能产生变化时生成当前内容的历史版本并立即保存，只有正文与排版结果都不变才跳过重复版本，并通过统一 Toast 区分保存完成、排版后保存、无需保存与保存失败，后台逐键自动保存仍不触发排版或版本记录。

- 新建文稿并完成当前选择切换后，编辑器会自动获得焦点，按钮、菜单与 `Command + N` 入口保持一致；普通文稿切换不会抢夺用户当前焦点。

- 精简未使用或易误触的快捷键：移除新建项目、标题、列表、引用、任务、前后文稿与 Markdown 预览组合键，将文稿搜索统一为 `Command + P`；`Command + /` 现在不再触发 CodeMirror 注释，只负责打开或关闭键盘快捷键面板；新增 `Command + Shift + \\` 单独显示或隐藏导航栏，并保留文稿列表当前状态。

- 恢复“帮助 → 欢迎界面”手动入口，并将其与首次启动设置流程分离：首次启动仍负责创建或打开写作文件夹，应用内回看只展示欢迎内容并返回当前写作，不重新暴露多写作库管理；右上角关闭入口复用标准小号图标 Button，并显式避让窗口拖拽层以保证反馈和点击生效。

- 统一模态窗与 Tooltip 的视觉边界：普通和阻塞 Dialog 改用更清晰的黑色半透明遮罩并移除全屏背景模糊；应用级 Tooltip 跨 Portal 只接管操作按钮，设置标题与普通说明文字不再触发系统原生提示，需要解释的概念继续使用问号按钮。

- 完善文稿跨项目移动的属性规则：完整保留文稿已有值和目标项目未定义的旧属性，只为空缺字段补充目标项目默认值；同名属性类型不一致时不自动转换或删除，并在移动完成后提示作者确认。

- 移除原型期项目模板及“空白项目模板”抽象：用户新建项目现在直接建立不含预设文稿、平台和业务标签的通用容器，首次建库的“落笔指南”继续作为产品内置教程保留。状态、标签、目标字数、摘要与创建/更新时间的实际值改由文稿模型直接维护；自定义属性同样归文稿属性管理，仅按项目隔离定义，项目设置不再批量控制已有文稿。项目和文稿持久化同步升级为新字段边界，不保留旧项目字段双读。

- 修复项目描述污染博客文章的问题：新建项目不再自动注入展示性描述；GitHub Hugo `description` 与 WordPress `excerpt` 只使用文稿显式摘要，摘要为空时不再回退到项目描述。

- 统一共享控件字号：Button、Input、Textarea、Select、菜单、Toggle、Tabs 与 Calendar 的主要交互文字现在统一消费现有 `text-app-base` 13px Token；Dialog 标题、说明和辅助元数据继续按各自语义字号呈现。

- 优化项目 GitHub 博客发布体验：确认窗口不再等待完整仓库授权查询，“发布/更新”可立即操作；点击后在进度首阶段定向验证目标仓库，授权问题引导前往设置，临时错误支持重试。GitHub 设置查询同时增加 60 秒原生快照与并发去重，并移除重复账户请求。

- 移除独立禅模式窗口、背景与声音设置、专属保存命令、快捷键、样式和内置背景资产；主编辑器内隐藏辅助栏位的“专注模式”继续保留。公众号主题编辑器仍为独立窗口，改用 macOS 系统标题栏与原生红绿灯，并删除自绘窗口控制及其颜色 Token。

- 修复主 AI 助手请求已被 Codex 完成、界面却因 app-server notification 丢失而长期空白的问题：每条连接按当前 turn 隔离事件，不再用不可靠的 thread 元数据误拒有效通知；静默时通过 `thread/read` 对账并恢复最终回复，避免消息永久停在“正在处理”。

- 优化主 AI 助手与公众号主题助手共享的 Codex 运行时：`app-server` 连接现在在应用进程内长生命周期复用，不再为每条消息重复启动和初始化；同一 thread 的未变化写作快照与最近对话不再逐轮重发，流式 token/步骤/usage 按绘制帧合并发布，Codex 全局高推理配置也不再静默覆盖落笔的模型和推理偏好；并补充跨轮事件隔离、动态 JSON-RPC request id、`turn/interrupt` 取消、超时淘汰、崩溃后自动重建，以及可随消息持久化比较的 cold/warm、thread、turn、首字与完成耗时。

- 为项目总览进入项目内部恢复可逆的横向层级推进动效：侧栏玻璃外壳和底部操作保持稳定，进入与返回使用相反方向，并在减少动态效果时降级为短淡化。

- 优化公众号主题编辑器专用 AI 助手：同一 Codex 主题线程续聊时不再重复发送完整 skill、主题、文章和对话历史，文章摘要会移除 Base64 图片数据，历史附件不再逐轮重发；普通问答只返回说明，视觉修改改用局部主题补丁并继续由落笔合并、完整校验、保存和记录撤销版本。主编辑器 AI 助手行为保持不变。

- 修复品牌更名后个人公众号主题仍保留 `nibva-*` 选择器、变量和类名而导致部分样式静默失效的问题：加载、导入和 AI 返回的旧主题会自动迁移并持久化为 `loby-*`，渲染器保留未归一化主题的兼容性告警，预览中的兼容性提示现在可点击查看完整明细。

- 统一公众号排版预览弹窗与主应用的背景、分割线和导航项样式，移除主题分类数量与多余图标底框，并将手机/电脑预览切换改用适配暗色模式的菜单分段控件。

- 为“发布到墨问笔记”增加公开与私密选择，复用文稿信息弹窗的分段切换组件并默认保持公开；私密笔记会先安全创建，再通过墨问隐私设置接口标记为仅自己可见。

- 重做墨问发布弹窗状态流：先确认标题、字符数和公开/私密范围，点击发布后再验证已保存的 API Key，并用打字机动画与真实进度条呈现处理过程，最后切换到成功或失败结果。

- 统一普通 Dialog 与主应用的背景 surface，修复暗色模式下“发布到墨问笔记”等弹窗背景比应用主体更深的问题；同时将墨问发布确认区改为无卡片嵌套的扁平摘要与可见范围设置，收紧弹窗高度和操作层级。

- 将 AI 对话流中的用户消息气泡从通用卡片背景中分离，改为亮色 `#F3F5F7`、暗色 `#2E2F30` 的中性灰色，缩小圆角并移除边线；输入框与已发送消息中的挂载文章标签同步使用相同圆角，AI 操作确认卡片保持原有背景。

- 修复文稿列表栏失焦后滚动条仍然常驻的问题：滚动条滑块现在仅在列表栏激活时显示，滚轮交互会重新激活列表栏，同时保留稳定滚动槽以避免布局抖动。

- 修复主 AI 助手修改审阅在段落拆分、加粗和高亮等仅改变换行或 Markdown 标记的场景下没有可见差异的问题；“显示更改”现在会高亮对应的正文范围。

- 修复应用 Toast 的暗色模式适配：移除 Toast 自身的液态玻璃层，改用亮色纯白与暗色抬升深灰实体背景，并同步调整描边、阴影、文字和状态色对比度。

- 将暗色模式的主主题色统一为导航栏列表项的深蓝高亮色，使主要按钮、焦点环、选中状态和导航高亮保持一致；同时将默认编辑器的 Markdown 高亮调整为 `#215176` 背景与 `#E9EEF1` 文字，并让 AI 助手发送按钮图标使用应用背景色而非纯黑。

- 优化空项目与项目导航体验：新建项目只保留“待整理”实体分组，不再自动生成首篇文稿；新增不会落盘的项目级“全部”筛选，统一编辑器与文稿列表空状态，并通过项目悬停进入图标强化进入项目的操作预期。

- 收敛暗色主题的视觉层级：降低编辑器右下角 AI 助手入口的玻璃外壳、彩色流体与外圈光晕亮度，将左侧导航栏与文稿列表的激活项统一为更沉稳的深蓝色，并降低普通图标按钮与液态玻璃按钮的图标亮度。

- 移除亮色和暗色主题下文稿列表失焦选中卡片的边框，保留低强调背景。

- 为文稿信息弹层建立可复用的菜单卡片、切换选中、标题、正文、辅助文字与弱图标色彩 token，并单独收敛暗色主题的灰阶层次。

- 为主应用的亮色、暗色临时切换增加从左向右推进的整窗过渡效果；设置中的自动或固定主题保持为持久策略，并在减少动态效果或运行环境不支持时即时切换。

- 优化左侧导航栏与文稿列表栏的展开、折叠动画，减少重复布局计算和玻璃面板缩放卡顿。

- 优化 AI 右侧边栏展开与折叠动画，减少重复布局动画和视觉卡顿，并补全“减少动态效果”支持。
- 简化项目篇数目标：直接统计项目内未归档文稿数量，移除文稿完成状态、右键完成标记、列表完成提示与 `completedAt` 持久化字段。
- 调整文稿右键菜单的信息顺序，并增加“使用默认应用打开”，保存最新内容后由系统默认 Markdown 应用打开本地文稿。
- 将键盘快捷键窗口改为 Linear 式靠右近全高面板，增加快捷键搜索、单列分组和独立 keycap 展示，同时保留 Loby 的通用模态框材质与关闭交互。

- Added Codex same-turn Steering to the main AI assistant, keeping the composer editable during active runs with dynamic steer/stop controls and persisted guidance messages; also centered and balanced docked and floating headers with always-visible conversation actions, a shared presentation icon, protection against duplicate blank conversations, and matching empty-state, thread, and composer styling in the WeChat theme assistant.
- Refined the AI conversation empty state and composer with the shared liquid orb, a subtle shimmering slogan, thinking-only border glow, a compact two-line auto-growing input, rotating writing prompts, tighter edge spacing, and a theme-aware circular send button.
- Added a responsive AI assistant surface with a compact animated liquid-glass launcher in the editor's bottom-right corner, animated floating window, retained resizable right sidebar, in-place presentation switching that preserves drafts and active runs, automatic width-aware defaults, and explicit default-shape preferences in AI settings.
- Removed the duplicate bottom-left article-goal sphere and folded its feedback into the bottom-right AI launcher: the current word count now rises from the launcher on hover or keyboard focus, appears for 2.8 seconds after each newly crossed hundred-word milestone, and preserves the former near-goal breathing and final-push motion without a native tooltip.
- Rebuilt the document outline as a compact editor-side heading navigator with proximity-tapered hover animation, on-hover titles, keyboard navigation, and click-to-reveal behavior, removing the higher-friction duplicate outline tab from the function rail.
- Raised the checked entry-bundle and Vite warning ceilings to retain the approved Motion spring interaction for the new heading navigator.
- Removed the duplicate Information tab from the document function rail while retaining document properties and statistics in the editor toolbar's Information popover.
- Replaced the left-rail Settings label with an icon-only button and added an adjacent single-button light, dark, and automatic application-theme cycle.
- Simplified the product to one user-facing writing folder with projects as the highest organization level: removed library switching and management from the rail, empty state, welcome menu, and settings; replaced the old library settings with File & Storage controls for revealing or moving the current folder; retained the multi-root registry and switching machinery for compatibility and recovery.
- Isolated workspace-navigation React coordination and invalid-selection repair in a rendered-and-tested hook, reduced `App.tsx` without moving top-level state or persistence ownership, and refreshed the project overview and architecture documents to match the current application.
- Redesigned the project document-property manager with a project-specific title, quieter row layout, bottom-aligned creation action, dialog-surface autofocus, fixed system properties, automatic removal of the legacy summary definition, and drag ordering for custom properties that carries into the document property panel.
- Simplified the article list into divider-separated rows with contiguous multi-selection cards, and unified light/dark surfaces, separators, text hierarchy, accent colors, toolbar icons, selection states, and shared control colors through reusable theme tokens.
- Refined shared liquid-glass controls with independent toolbar buttons, restrained dark-mode borders and icon contrast, theme-aware inactive navigation and sheet selections, and matching dark treatment for the floating list/function switcher.
- Restyled application toasts with a compact liquid-glass surface, restrained status icons, neutral text, and no persistent close button while preserving optional actions.
- Added writing-library-local AI quick prompts with a 20-item settings manager, direct launch buttons in empty conversations, and shared `/` lookup that inserts saved prompt content into the composer for review before sending.
- Added three-level writing goals: daily check-ins for non-empty articles created or edited that day, three blue heatmap intensities for ordinary writing, newly reached article goals, and multi-article goal days, richer recent/full activity statistics, project word or article-count targets, project-wide default article targets, sidebar goal progress and project summaries, per-article progress rings in the main and Zen editors, near-goal pulse and shake feedback, and optional one-time burst, toast, and sustained confetti on reaching a goal.
- Moved portable writing-library preferences and WeChat theme work state into `.loby/`, with compatibility migration from existing device-local storage.
- Added an independent desktop File-menu action for conservatively scanning unused shared images, reviewing candidates in a large scrollable thumbnail grid, opening them through macOS Quick Look, saving copies elsewhere, and moving confirmed images into the restorable Loby trash without breaking live documents, sheet history, or trashed Markdown references.
- Added a desktop File-menu action for moving accidentally created blank sheets into the writing library's hidden local trash while preserving titled or non-empty documents, and changed empty-trash cleanup to hand the local trash folder off to the operating system trash for one final recovery layer.
- Added multi-selection to the main sheet list and direct cascading context-menu moves across Inbox, Notes, projects, and groups, including batch moves, a full-location fallback, undo feedback, and exclusion of the built-in `落笔指南` project from move destinations.
- Added configurable Markdown document formatting from the `中文排版` sheet-card action, with five compact writing settings for whitespace cleanup, block spacing, Markdown markers, Chinese/Latin spacing, and context-aware full-width punctuation; formatting protects metadata, code, links, image paths, versions, dates, and file paths, records a pre-format sheet snapshot, and reports completion, no-op, or failure through compact four-state toast notifications.
- Isolated workspace-selection and shared-image resource boundaries, adding regression coverage for navigation repair, pointer-drag lifecycle, and guarded legacy-image cleanup without changing user-facing behavior or persistence formats.
- Added compact, cancellable document-card dragging with delayed project drill-in, quick return to the full library, and direct group drops; centralized all writing images under the library root `assets/images`, rewrote image references when sheets move, and safely consolidated legacy project image folders without breaking shared references.
- Removed the visible macOS startup resize by keeping the maximized main window hidden until its web content has finished loading, so the native traffic-light controls and application surface now appear together.
- Fixed shared confirmation dialogs so opening one focuses the dialog surface instead of visually preselecting the cancel button, while preserving keyboard navigation between actions.
- Moved personal WeChat themes into each writing library's visible `themes/` directory as one readable `.lobywechat` file per theme, while keeping AI conversations, undo/redo history, favorites, and default-theme preferences in library-scoped application state.
- Added a system-level writing inbox, renamed project default groups to `待整理` and the notes default group to `随手记`, routed new drafts by context, and added `Command+D` quick capture with persistent unsent drafts and matching timestamp document titles/H1 headings plus drag- and dialog-based document moves with legacy-folder migration.
- Added focused external-library refresh, large-library selection, Markdown import, project-field rendering, and project-export compilation tests; split WeChat theme studio, Zen Mode, project-field presentation, and browser export effects from their coordinators or pure logic.
- Escaped user-authored project titles in compiled HTML exports so title markup remains text.
- Made folder-first library rebuilds deterministic, ignored hidden Markdown files, and restored generated `project.toml` metadata plus sheet order when the library index is missing.
- Split native export writing into a focused module and reject unsafe or conflicting bundle destinations before creating partial output.
- Fixed publishing settings treating the initial secret-status lookup as a missing Mowen API Key after restart, and now surface saved, loading, and read-failure states without returning secret values to the renderer.
- Moved image hosting under Publishing and reworked it into a service directory with Aliyun OSS secondary configuration, masked refill and reveal for the user-saved Secret, an explicit add flow, automatic display of existing complete configurations, and a disabled Tencent COS preview.
- Added Aliyun OSS image-host settings and a WeChat preview upload action that uploads local article images in the desktop backend, rerenders preview/copy HTML with public URLs, and leaves source Markdown unchanged.
- Redesigned the WeChat publishing preview as a full-height two-column workspace with card-style blue theme selection, complete iPhone and 677px desktop canvases, a right-side liquid-glass preview toolbar, and aligned icon-only liquid-glass copy and close actions.
- Refined the WeChat theme studio article rail with the shared sliding function switcher, a dedicated built-in example section, a flat recent-first all-articles list, progressive loading, and library-wide search.
- Redesigned the WeChat theme studio's manual style controls with compact measurement steppers, direct numeric and keyboard input, single-row color fields, and a perceptual shadow-strength slider.
- Simplified the WeChat theme preview by removing its toolbar and zoom controls, centering the shared phone/desktop switcher above a fixed outer canvas, rendering the 402-by-874-point iPhone 17 Pro viewport inside a Silver device-frame asset at 100% when space allows, matching the public WeChat desktop article width at 677px without a device frame, adding preview-only light/dark appearance controls, keeping article scrolling inside the preview, using a solid window toolbar, and adding a tested rich-layout copy action beside Save Theme.
- Refined the WeChat-theme AI assistant with a wider responsive column, a clipped fading header, balanced edge spacing for header actions, and warmer 2–3 sentence replies that explain the visible change and what to check next.
- Compressed the built-in WeChat sample cover and embedded it as clipboard-safe image data, with copy-time inlining as a fallback for other app-local article images.
- Added live Codex run steps, reasoning progress, read-only tool activity, token usage, cancellation, and per-theme multi-conversation history to the WeChat-theme AI assistant using the same run and conversation controls as the main assistant, with autonomous reading of user-provided local references and no step-by-step approvals.
- Unified the main and WeChat-theme AI assistants around shared panel chrome, message surfaces, thread spacing, composer framing, and toolbar controls while keeping their runtime and domain workflows separate.
- Added temporary pasted, dropped, and file-picked image attachments to the main and WeChat-theme AI assistants, with native Codex multimodal input, thumbnail previews, guarded process-scoped temporary storage, and no image persistence in projects or conversations.
- Added a standalone WeChat theme studio with direct universal typography, color, and layout controls; unrestricted AI-authored presentation CSS and reusable HTML transforms; inline WeChat compatibility compilation; reusable personal themes; live article preview; automatic app-data persistence; per-theme conversation history; and bounded undo/redo history.
- Added a macOS Zen Mode with a simple-fullscreen background layer and a separate movable, resizable, tileable writing window that edits the active Markdown file directly, reuses the main editor's Markdown rendering and format controls, and includes persistent background and offline sound controls.
- Added read-only historical-version previews in the editor with a persistent return-to-current control, direct restore action, and automatic backup of the current body before restoration.
- Unified Select, dropdown, and context menus around liquid-glass triggers and panels, collision-aware placement, and clearer neutral hover states.
- Added an editor publishing center with extensible WeChat layout previews and rich HTML copy, plus cross-platform app-config-backed WordPress and Mowen draft/public publishing with image upload.
- Fixed Mowen notes dropping a trailing image, added attachment-count validation, and optimized large local publishing images through self-cleaning temporary JPEG copies without modifying source files.
- Refined the shared confirmation-dialog layout and fixed moving notes from the special inbox area into the library trash.
- Fixed pasted image references disappearing when resource file events arrived before the edited Markdown had been saved.
- Replaced numeric suffixes on conflicting imported image names with stable short hashes while preserving every copied file.
- Added light, dark, and system-following application appearance plus four independently selectable editor themes with matched light/dark palettes.
- Added a centralized, extensible keyboard-shortcut system with common project, sheet, navigation, view, application, and Markdown editing actions plus an in-app shortcut overview.
- Debounced and serialized writing-library and AI-conversation saves so rapid editing and streaming updates persist only the latest pending state without overlapping writes.
- Skipped unchanged managed-file writes and added safe temporary-file replacement for macOS/Linux persistence.
- Split native watcher, project-path, resource, and system-path responsibilities out of the Tauri composition root.
- Split AI conversation storage and writing-library trash operations into focused native modules.
- Split writing-library scanning, index coordination, and managed-file persistence into `library` domain modules.
- Split Agent discovery, process resolution, timeout handling, and app-server event translation into focused native modules.
- Split Agent runtime, app-server transport, JSON-RPC protocol construction, and Tauri application composition into focused native modules.
- Split wastebasket session state and restore/delete actions out of the frontend app coordinator.
- Added a pull request review template, risk-based review guide, Dependabot updates, tracked local verification hooks, and a production bundle budget.
- Lazy-loaded AI, settings, and field-management surfaces, reducing the main production JavaScript chunk and making Markdown export imports effective async chunks.
- Split project-field migration coordination from editor/list views and destructive-change confirmation dialogs.
- Added a repository-level Codex branch/PR policy and tracked Git hooks that prevent accidental direct commits or pushes to `main`.
- Added ESLint, Prettier, Vitest, Rust check, and Clippy quality gates.
- Added the local `npm run check` quality gate used by Git hooks and reviewed pull requests.
- Added initial unit tests for AI context helpers, agent run state merging, and project creation helpers.
- Added development, security, and contribution documentation.
- Pinned Node and Rust toolchain versions for reproducible local development.
