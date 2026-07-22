# app/ - 应用组合层

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

<member>
App.tsx - 主窗口协调器，持有跨功能状态、持久化所有权与主要界面组合
AppRoot.tsx - 多窗口入口选择器，按窗口类型装配主应用、禅模式与公众号主题工作室
</member>

这里可以组合 feature，但不得吸收稳定的领域规则、长 JSX、大型选项/palette 或平台适配。新 modal、panel、inspector tab、sidebar、toolbar 或 picker 从所属 feature 的独立组件开始。拆出状态所有权前必须先有聚焦的集成测试，不能为了缩短 `App.tsx` 改变持久化与交互时序。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
