# ui/ - 本地 shadcn primitives

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

本目录封装 Radix 与原生表单行为，向 feature 提供稳定、无业务语义的 UI 基础。视觉只消费 Tailwind 语义 utilities 和 `styles/index.css` Token；不得依赖 app、具体 feature、持久化或领域状态。

<member>
alert-dialog.tsx - 阻塞确认 Dialog primitives，统一无模糊强 scrim、焦点接管与 action/cancel 排列
alert-dialog.test.ts - AlertDialog 内容尺寸、表面与焦点契约回归
button.tsx - Button variants、sizes、13px `text-app-base`、surface 交互表面与 Slot 组合基础；按压状态不改变控件几何位置，`surface="transparent"` 仅关闭背景反馈并保留文字、焦点与按钮语义
calendar.tsx - react-day-picker 的 Loby 语义样式、13px 日期交互文字与日期导航适配
checkbox.tsx - Radix Checkbox 的选中、无效与键盘焦点状态
context-menu.tsx - Radix ContextMenu 的共享菜单材质、13px 条目、图标、快捷键、子菜单与 separator
controlTypography.test.ts - Button、Input、Textarea 与 Toggle 的 13px `text-app-base` 排版契约回归
dialog.tsx - 通用 Dialog primitives，统一无模糊半透明 scrim、焦点接管、close 与同表面 footer
dialog.test.ts - Dialog 表面、footer 排列与自动焦点契约回归
dropdown-menu.tsx - Radix DropdownMenu 的键鼠交互模式、共享菜单材质、13px 条目与选中状态
input.tsx - 原生 input 的 13px 文字、尺寸、表单状态与可访问焦点基础
popover.tsx - Radix Popover 的 glass/solid 两种共享浮层容器
progress.tsx - Radix Progress 的语义轨道与进度指示器
select.tsx - Radix Select 的 13px trigger/条目、compact/default/wide/full/fit 五档 trigger 宽度、可选等宽/内容/固定 popup 宽度、滚动控件与紧凑条目几何
select.test.ts - Select 13px 字号、语义宽度映射、Trigger/Content 默认等宽、独立宽度与超长条目截断契约回归
slider.tsx - Radix Slider 的单值/多值与水平/垂直范围输入
sonner.tsx - Sonner Toaster 的主题 Token 与状态图标适配
suggestion-menu.tsx - 输入触发的 listbox 建议浮层，复用 DropdownMenu 实体材质、菜单 Token 与双行条目状态
suggestion-menu.test.ts - SuggestionMenu 材质、圆角、字号与 active option 语义契约回归
switch.tsx - Radix Switch 的尺寸、选中状态与 thumb 动画
textarea.tsx - 原生 textarea 的 13px 文字、自适应高度与表单状态基础
toggle-group.tsx - Radix ToggleGroup 的方向、间距与共享 variant 上下文
toggle.tsx - Radix Toggle 的 13px 文字、variants、sizes 与 pressed 状态
</member>

依赖方向为 `feature/shared → components/ui → Radix/原生元素`。新增 primitive 必须保持无业务语义；与产品状态相关的组合组件留在调用方所在 feature 或 shared。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
