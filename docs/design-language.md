# 设计语言

## 方向

Loby 是安静、清爽、白色优先并支持高质量暗色模式的桌面写作工具。编辑器保持视觉中心，导航、列表、检查器、发布与 AI 表面使用克制层级，不堆叠装饰性卡片或高饱和状态块。

## Design Token

颜色、字体、圆角与共享组件几何的唯一详细台账是 `src/styles/TOKENS.md`，实际值以 `src/styles/index.css` 为准。本文件只定义产品规则，不复制易漂移的 Hex、像素或迁移进度。

- 普通界面消费语义 Token，不按“看起来像某个灰色”借用无关变量。
- `background` 是应用主背景；`card`、`popover`、`muted` 和专用 surface 各自表达稳定层级。
- Context Menu、Dropdown Menu 与 Select 菜单统一使用 `--menu-background`，通过边框和阴影建立浮层，不借用 `popover` 改变底色。
- 状态色通过 `destructive`、`status-success`、`status-warning` 等语义表达，不在组件中固定 Tailwind 色阶。
- 亮暗模式必须共同设计；不能先写亮色再依靠透明度碰运气生成暗色。

## 组件基础

- 普通布局和状态使用 Tailwind CSS v4。
- Button、Input、Dialog、Menu、Select、Tooltip、Tabs 等共享控件来自 `src/components/ui/` 或受控的 `src/components/animate-ui/`。
- Animate UI 只用于运动能改善反馈或状态连续性的场景。
- Liquid Glass 是少量浮动表面的明确例外，不是普通卡片和菜单的默认材料。
- 新组件优先组合现有 primitive；确需 variant 时在共享组件中建立显式 API，不让调用方叠加互相覆盖的 class。

## 字体、圆角与密度

应用 UI 使用既定六级字体 Token 和 shadcn 语义圆角尺度。普通控件不得引入新的中间字号或自定义圆角；特殊几何只允许用于圆形/胶囊、设备模型、插画和用户发布主题。

导航项、Select 与设置 Dialog 的具体共享几何见 `src/styles/TOKENS.md`。调用方提供内容和状态，不重复定义组件内部 padding、图标尺寸、圆角和默认宽度。

## 菜单与选择器

- 菜单项保持单行、紧凑、左侧对齐，图标/文字与高亮边缘有一致的小间距。
- hover 和键盘 active 使用中性表面；亮色菜单使用 `#F4F4F4` hover 背景，暗色菜单使用 `#27272A` hover 背景，两种主题的 hover 文字均回到应用前景色；selected 使用 checkmark 表达，不长期铺设彩色背景。
- 弹层优先与触发按钮的内容边缘对齐，并在视口不足时由 Floating/Radix 定位系统调整。
- Select 的 Trigger 决定宽度，Content 与 Trigger 等宽；调用方选择 `compact/default/wide/full/fit` 语义档位。

## Tooltip

统一使用 Animate Tooltip：延迟出现、方向稳定，浮层消费 `popover` 语义，使亮色模式使用亮色背景、暗色模式使用暗色背景；使用 `0.5px` 边线和弱阴影建立层级，不显示三角箭头。尾部快捷键自动拆成独立 `kbd` keycap，以 `muted` 表面和细边框建立层级；普通括号说明保持原样。纯标题重复、当前已可见文本或没有额外信息的控件不添加 Tooltip。消失动画必须围绕原触发器完成，不能因 Portal 布局退出而漂移到页面中心。

## Tabs 与模式切换

统一使用共享 Animated Tabs 作为分段切换器。指示块必须在相邻值间连续移动，容器与指示块圆角、内边距保持同心；暗色高亮应清晰但不使用沉重纯黑块。可以只使用 tab 列表，不强制渲染内容面板。

## 导航焦点

选择与焦点是两个状态：

- 活跃导航栏中的选中项使用 system-blue primary；
- 焦点移动到另一个栏或编辑器后，导航和文稿选择保留但转为非活跃语义；
- 点击编辑器不会清空选择；
- 键盘 `focus-visible` 必须可辨认，鼠标点击不制造多余焦点噪声。

## 编辑器与 AI

- CodeMirror 正常写作优先使用浏览器原生选区；只有明确回归才启用自绘 selection。
- AI 模型、推理和速度保持为输入区工具栏的紧凑文字控件，复用 `AssistantModelSettingsMenu`。
- AI 修改卡片保存在聊天历史，详细 diff 在编辑器显示；新增用蓝色，删除用柔和删除线，不变文字不标记。
- AI 面板、消息和 composer 的普通布局使用 Tailwind；富 Markdown、diff、CodeMirror 与状态动画留在对应领域样式文件。

## 避免

- 米黄纸张主题、装饰性渐变、重阴影卡片墙和喧闹 AI dashboard；
- 在组件里写死颜色、圆角、字号或重复共享控件几何；
- 为追求“全部 Tailwind”删除必要的编辑器、发布预览或动效 CSS；
- 让主题、发布模板或用户内容反向污染应用全局 Token。
