# styles/ - renderer 样式所有权

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

`index.css` 是全局设计系统的唯一值源：公共语义采用 shadcn/Tailwind 命名，Loby 扩展语义只表达跨组件层级、状态、渠道和固定预览画布；设置卡片外框与更浅的内缩行分隔也由独立组件语义 Token 建立层级。字体使用六级语义尺度，圆角只使用 shadcn 的基础值与倍率尺度；`shadcn.css` 只做框架映射，`base.css` 只做 reset，普通 stylesheet 不得重新声明 `:root` 全局主题值。

共享组件可以组合现有 Tailwind spacing Token 形成稳定几何契约，不为单一组件创建同值 CSS 变量。可操作共享控件的文字统一消费 `text-app-base` 13px；`NavigationItem` 作为连续导航内容保留 `text-body` 14px，其字号、图标、尺寸、内边距、图文间距与圆角由组件集中持有。列表容器只负责 `4px` 项间距；完整数值以 `TOKENS.md` 为准。

全局 Token 分为基础通道、公共语义、Loby 扩展语义和组件语义；旧名称兼容层已经删除，并由架构门禁阻止回流。编辑器 palette、发布输出主题、用户颜色及运行时状态变量属于领域数据，可以保留在明确作用域内；出现在普通应用 UI 的 AI/渠道品牌色仍由 `index.css` 持有。开发态设计系统实时扫描 Token 引用和裸色位置，普通 UI 的 HEX、numeric color function 与 Tailwind 固定 palette 必须全部清零。

背景颜色统一使用 `background` 命名：全局层级采用 `--background-*`，组件专属值采用 `--{component}-background`；不得新增含 `surface` 的颜色 Token。与 `--background` 同值的透明通道直接通过 `color-mix()` 派生，不维护重复 RGB 值。

AI inspector 的 docked 与 floating 模式共享不透明 `--background` 内容材质；floating 只拥有圆角、边框、阴影和悬浮几何，不得重新叠加透明背景或 backdrop blur。

<member>
TOKENS.md - 语义命名、领域边界、旧名称映射与分阶段迁移台账
index.css - 全局明暗语义 Token、六级字体尺度、组件 Token 与稳定布局尺度的唯一值源
shadcn.css - Tailwind CSS v4、shadcn 与 Animate CSS 的导入及语义字体/主题命名空间映射
base.css - 浏览器 reset、13px 默认 UI 字号、文档默认值、原生控件继承与共享菜单材质
shell.css - 桌面窗口、三栏工作区、resizer、左缘悬停导航与 inspector 几何
left-workspace-glass.css - 左侧工作区液态玻璃材质、临时悬浮显隐及透明降级
library-rail.css - 写作文件夹导航的拖放、打开进度与重排反馈
writing-goals.css - 写作活动热力与现役项目目标进度动画
sheet-row.css - 文稿行组合选中、焦点分离与拖放状态
editor.css - CodeMirror、工具栏侧栏避让、Markdown 装饰与编辑器浮层
publishing.css - 发布预览、设备外壳与加载动画
toast.css - Sonner Toast 的 Loby 视觉适配
rail-mode-switch.css - 左栏模式切换器的玻璃材质与状态动画
ai.css - AI composer glow 动画
assistant-surface.css - AI inspector 外壳、响应式几何与拖动例外
ai-thread.css - AI 消息完整 GFM 排版、标题/表格/代码/任务列表/引用表面与消息动画
ai-action-image-preview.css - AI 图片成果在消息流中的完整预览与原生 Quick Look 触发状态
ai-review.css - 持久化 AI diff 的新增、删除与审阅状态
settings-controls.css - 设置中的编辑器主题缩略预览 palette
themes.css - 暗色复杂材质例外与作用域化编辑器主题 palette
responsive.css - 窗口宽度驱动的 rail 与 inspector 几何覆写
</member>

依赖方向为 `index.css → shadcn/base → 功能例外 → themes/responsive` 的消费关系；后层可以覆盖局部作用域，不得反向成为全局 Token 的值源。普通布局和控件状态优先 Tailwind/shadcn，新增 stylesheet 前先确认现有责任边界不能容纳。

Tailwind Preflight 已启用；native、CodeMirror、liquid glass 等例外必须显式声明依赖的浏览器样式，不依赖 user-agent defaults。`styles.css` 只是 import entrypoint；AI header/thread/review 分别由 `ai.css`、`ai-thread.css`、`ai-review.css` 承载，普通 AI 布局与控件仍使用 Tailwind/shadcn。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
