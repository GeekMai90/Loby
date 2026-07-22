# design-gallery/ - 开发态设计系统陈列室

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

<directory>
components/ - 连续组件矩阵与可交互状态样例
</directory>

该 feature 只服务本地开发和视觉回归，不读取写作库、应用设置或业务持久化。导航项与页面模块必须同时受 `import.meta.env.DEV` 保护，生产构建不得保留可访问入口或页面 chunk。

组件样例必须直接复用产品共享组件，并标注 `styles/TOKENS.md` 已确认的真实尺寸；禁止为了陈列效果复制一套近似样式。英文组件名后必须紧跟中文名，降低组件检索和沟通成本。页面与格子统一使用应用工作区真实的 `--background` 背景，格间只以 `--separator` 分隔，确保亮暗色组件在实际承载面上判断对比度。双主题语义色卡按基础表面、交互、边界和状态四组陈列 17 个高频 Token，从实际 CSS 取色并由浏览器实时换算 HEX，避免另建易漂移的色值表。Toast 样例直接渲染真实 `AppToast`，同时覆盖成功、错误、警告与信息状态，并通过正式 `showAppToast` 链路提供动效触发入口。Select、Dropdown Menu 与 Context Menu 使用独立格子连续陈列，并共享实体菜单材质和紧凑条目几何；Context Menu 使用真实右键触发并覆盖图标、快捷键、子菜单、separator 与危险操作。Tooltip 与 Tabs 样例使用本地 Animate UI 成品入口，以真实 spring 动画展示浮层、选中高亮和内容过渡；Tabs 连续展示单图标、图标文字与内容切换三种形态，避免旧切换器近似实现回流。Navigation Item 样例同时覆盖激活、失焦与普通状态，并使用正式 `4px` 项间距。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
