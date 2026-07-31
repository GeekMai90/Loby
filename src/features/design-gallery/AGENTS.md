# design-gallery/ - 开发态视觉治理工具

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

<directory>
components/ - 共享开发工具页外壳、独立颜色系统、字体/圆角/四级阴影规范、连续组件矩阵与可交互状态样例
</directory>

<member>
components/DesignGallery.tsx - 开发态组件矩阵入口，直接陈列基础 Token、正式共享控件、发布状态与更新提醒卡片的可交互状态
colorAudit.ts - 通过 Vite raw glob 读取当前 renderer 源码，派生代表性语义 Token 引用、特殊视觉过滤、裸色位置、领域豁免与未使用状态
</member>

该 feature 只服务本地开发和视觉回归，不读取写作库、应用设置或业务持久化。侧栏的“设计系统”“颜色系统”导航与两个页面模块必须同时受 `import.meta.env.DEV` 保护，生产构建不得保留可访问入口或页面 chunk。两个页面必须复用 `DeveloperGalleryShell` 的标题栏、关闭入口和滚动矩阵，页面之间只切换内容职责。

`ColorSystemGallery` 独立承载全部颜色治理：以相同顺序展示亮暗核心 UI 语义、按浏览器实际值去重的色板与语义别名，并从 `index.css` 和 renderer 源码实时派生复杂材质、直接/间接引用、裸色位置、领域豁免、未使用 Token 和近似色候选。阴影与渐变作为材质审计独立于纯色卡片；左侧导航玻璃背景的 `--sidebar-glass-*` 与 AI 助手启动按钮的 `--assistant-launcher-*` 属于独立视觉作品，不进入基础色板、重复色或近似色治理。普通 UI 裸色必须为零，编辑器主题、用户持久化 palette 与发布内容色只作为领域数据登记。

`DesignGallery` 只承载字体、圆角、四级阴影候选与组件样例，不得重新吸收颜色长页。组件样例必须直接复用产品共享组件，并标注 `styles/TOKENS.md` 已确认的真实尺寸；禁止为了陈列效果复制一套近似样式。英文组件名后必须紧跟中文名，页面与格子统一使用真实 `--background`，格间只以 `--separator` 分隔。GitHub 与墨问发布状态主体直接复用 production views；Toast 使用真实 `AppToast`；Select、Dropdown Menu、Context Menu、Tooltip、Tabs 与 Navigation Item 均使用正式共享组件和既有交互契约。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
