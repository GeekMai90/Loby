# animate-ui/ - 可选动效组件源码

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

本目录保存由 Animate UI registry 引入并在仓库内维护的源码。`components/` 只负责连接 Loby 语义样式，`primitives/` 负责 motion、定位、共享状态与组合行为；产品状态不得进入这里。

<member>
components/animate/tooltip.tsx - Tooltip 唯一成品入口，消费 popover/muted 明暗语义、将尾部快捷键拆为 keycap，并接管现有 title/data-tooltip 目标
components/animate/tabs.tsx - Tabs 成品入口，以 13px `text-app-base` 与 Loby 语义 Token 包装官方 spring 高亮和内容过渡
primitives/animate/slot.tsx - 支持 motion、asChild 与 ref 合并的底层 Slot
primitives/animate/tabs.tsx - Tabs 选中状态、触发器注册、可变高度测量与横向内容动画核心
primitives/animate/tooltip.tsx - 基于 Floating UI 与 motion 的共享 Tooltip 浮层、定位和 spring 动效核心
primitives/effects/highlight.tsx - 跨组件复用的激活项边界测量与 spring 高亮核心
primitives/texts/sliding-number.tsx - 基于 motion spring 的逐位数字滚动 primitive
</member>

registry 生成的公共工具必须改接 `shared/`，不得保留 `@/lib`、`@/hooks` 等旧路径；本地适配只调整依赖方向、GEB 契约与语义 Token，不随意改写上游交互状态机。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
