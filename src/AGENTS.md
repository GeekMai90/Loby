# src/ - React renderer

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

`src/` 采用 feature-first 骨架：`app` 负责组合，`features` 负责产品能力，`shared` 负责跨功能契约；基础控件与样式保留独立所有权。

<directory>
app/ - 应用组合根与跨功能状态所有权
features/ - 按产品能力划分的界面、hooks、模型与常量
shared/ - 不依赖具体 feature 的公共组件、hooks、工具、常量与类型
components/ - shadcn/ui 与 Animate UI 的源码基础
styles/ - tokens、reset 与明确的复杂视觉例外
assets/ - 由 Vite 打包的 renderer 静态资产
</directory>

<member>
main.tsx - renderer 启动入口，只挂载 AppRoot 与全局样式
styles.css - 样式 import entrypoint，不承载功能规则
vite-env.d.ts - Vite 类型声明
</member>

依赖方向以 `app → features → shared` 为主；`shared` 禁止反向依赖 `app` 或具体 feature。历史 feature 间协作暂保留显式路径，新增依赖优先通过 shared 契约或由 app 协调，避免形成新的循环。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
