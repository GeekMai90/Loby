# components/ - UI 源码基础

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

<directory>
ui/ - 本地 shadcn/ui primitives 与其聚焦测试
animate-ui/ - 从 registry 复制并本地维护的可选动效 primitives
</directory>

这里不放产品 feature 组件。基础控件依赖 `shared/lib/utils.ts` 合并 class；产品语义、业务状态和持久化必须留在 feature 或 app。

Tailwind CSS 4 和本地 shadcn primitives 是普通 UI 基础；不重复实现 button、input、dialog、menu、tooltip 或 progress。普通按钮使用 `Button` 标准 variants，`LiquidGlassButton` 是明确的复合材质例外。Animate UI 只在动效能明显改善反馈或状态过渡时使用。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
