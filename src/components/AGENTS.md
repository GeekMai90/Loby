# components/ - UI 源码基础

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

<directory>
ui/ - 本地 shadcn/ui primitives 与其聚焦测试
animate-ui/ - 从 registry 复制并本地维护的可选动效组件与 primitives，当前提供数字滚动、Tooltip 和 Tabs
</directory>

这里不放产品 feature 组件。基础控件依赖 `shared/lib/utils.ts` 合并 class；产品语义、业务状态和持久化必须留在 feature 或 app。registry 所需的无领域 hooks/lib 必须归入 `shared/`，不得让安装器重新创建 `src/hooks`、`src/lib` 等旧技术分层。

Tailwind CSS 4 和本地 shadcn primitives 是普通 UI 基础；不重复实现 button、input、dialog、menu、tooltip 或 progress。普通按钮统一使用 `Button` 标准 variants，不再维护平行的材质按钮实现。Animate UI 只在动效能明显改善反馈或状态过渡时使用。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
