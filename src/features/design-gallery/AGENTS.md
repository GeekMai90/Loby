# design-gallery/ - 开发态设计系统陈列室

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

<directory>
components/ - 连续组件矩阵与可交互状态样例
</directory>

该 feature 只服务本地开发和视觉回归，不读取写作库、应用设置或业务持久化。导航项与页面模块必须同时受 `import.meta.env.DEV` 保护，生产构建不得保留可访问入口或页面 chunk。

组件样例必须直接复用产品共享组件，并标注 `styles/TOKENS.md` 已确认的真实尺寸；禁止为了陈列效果复制一套近似样式。Navigation Item 样例同时覆盖激活、失焦与普通状态，并使用正式 `4px` 项间距。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
