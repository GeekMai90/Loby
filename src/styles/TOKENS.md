<!--
[INPUT]: 依据 index.css 的实际 Token 契约与各 stylesheet 的当前消费关系
[OUTPUT]: 提供 Token 命名边界、旧名称迁移台账与分阶段改造顺序
[POS]: styles 的设计系统导航文档；解释语义与迁移状态，具体值始终以 index.css 为唯一事实来源
[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
-->

# Loby 语义 Token 台账

## 所有权

- `index.css` 保存应用全局 Token 的明暗值；其他文件只消费，不重复定义全局主题。
- `shadcn.css` 只把语义 Token 映射为 Tailwind utilities。
- `themes.css`、`settings-controls.css` 和 `zen-mode.css` 可以在明确作用域内维护 editor palette。
- 发布输出主题、品牌色、用户持久化颜色和测试 fixture 是领域数据，不进入应用全局 Token。

## 核心语义

| 语义           | Token                                                         | 使用边界                                  |
| -------------- | ------------------------------------------------------------- | ----------------------------------------- |
| 应用背景与正文 | `--background` / `--foreground`                               | 页面背景与默认文本                        |
| 卡片与浮层     | `--card` / `--popover`                                        | 分组卡片与非菜单浮层                      |
| 专用层级       | `--surface-canvas` / `--surface-soft` / `--surface-tint`      | 下沉画布与明确命名的柔和层级              |
| 主要操作       | `--primary` / `--primary-foreground`                          | system blue 操作、激活选择与焦点          |
| 柔和交互       | `--accent` / `--accent-foreground`                            | hover、菜单 active 等中性表面，不表示主色 |
| 次级信息       | `--muted` / `--muted-foreground`                              | 次级背景与辅助文字                        |
| 边界与焦点     | `--border` / `--input` / `--ring`                             | 控件边框、输入边界与键盘焦点              |
| 图标按钮       | `--button-icon-foreground` / `--button-icon-hover-background` | ghost 图标按钮的默认文字与悬停表面        |
| 状态反馈       | `--destructive` / `--status-success` / `--status-warning`     | 删除、成功与警告                          |

暗色模式的 `card` 使用比 `background` 略亮的中性灰 `#262626`，建立稳定分组层级；它与当前 `muted` 只保持同值，不互相引用，避免两个语义随任一方调整而意外耦合。`popover` 继续复用 `surface-tint`，保持浮层与长期内容容器的语义差异。

Context Menu、Dropdown Menu、Select 与编辑器实体菜单统一消费 `--menu-background`，并直接映射应用 `background`；菜单依靠边框和阴影建立浮层层级，不借用 `popover` 改变底色。亮色菜单的文字与图标使用 `#303032`，hover 使用 `#F4F4F4` 中性表面和应用 `foreground`；暗色菜单的文字与图标使用 `#E3E5E7`，hover 使用 `#27272A` 中性表面和应用 `foreground`。

Tooltip 属于非菜单浮层，表面与文字消费 `popover` / `popover-foreground`，因此亮色模式保持亮色浮层、暗色模式保持暗色浮层；快捷键 keycap 消费 `muted` 与公共边界语义，不另建一套主题色。

AI 变更审阅的新增与删除行分别消费 `--assistant-diff-added-bg`、`--assistant-diff-removed-bg`；暗色模式从 `status-success`、`destructive` 与 `card` 混合低对比背景。AI 操作卡片的警告边框、背景和文字统一消费 `--status-warning`，不再使用 Tailwind 固定 amber 色阶。

## 字体尺度

应用界面只使用以下六级字号。`13px` 是默认 UI 基尺寸，普通组件不得引入列表之外的中间字号；`24px` 是应用界面上限，不约束编辑器正文与发布内容的用户可配置字号。

| 语义     | Token                  | Tailwind utility | 字号   | 使用边界                         |
| -------- | ---------------------- | ---------------- | ------ | -------------------------------- |
| 辅助信息 | `--font-size-caption`  | `text-caption`   | `12px` | 时间、状态、说明与次要元数据     |
| 基础界面 | `--font-size-base`     | `text-app-base`  | `13px` | 菜单、按钮与默认 UI 文字         |
| 正文控件 | `--font-size-body`     | `text-body`      | `14px` | 导航项、正文、输入与主要控件文字 |
| 分组标题 | `--font-size-subtitle` | `text-subtitle`  | `16px` | 面板标题与重要分组标题           |
| 页面标题 | `--font-size-title`    | `text-title`     | `18px` | 页面标题与主要内容标题           |
| 展示标题 | `--font-size-display`  | `text-display`   | `24px` | 强调标题；应用界面最大字号       |

## 圆角尺度

应用界面直接采用 shadcn 的单一基础值和倍率尺度，不再维护 `control`、`panel` 等平行尺寸。普通界面只能使用下表中的 Token 或 Tailwind utility；历史硬编码值按视觉角色就近归并。`0`、`inherit`、圆形/胶囊形的 `rounded-full` 以及插画、设备模型、用户发布主题中的几何数据不属于普通界面圆角。

| 层级        | Token           | Tailwind utility | 默认值            | 推荐边界                 |
| ----------- | --------------- | ---------------- | ----------------- | ------------------------ |
| Small       | `--radius-sm`   | `rounded-sm`     | `6px`             | 微型表面、紧凑内部元素   |
| Medium      | `--radius-md`   | `rounded-md`     | `8px`             | 菜单项、紧凑控件         |
| Large       | `--radius-lg`   | `rounded-lg`     | `10px`            | 默认按钮、输入框、导航项 |
| Extra Large | `--radius-xl`   | `rounded-xl`     | `14px`            | 卡片、Popover、普通浮层  |
| 2X Large    | `--radius-2xl`  | `rounded-2xl`    | `18px`            | Dialog、主要面板         |
| 3X Large    | `--radius-3xl`  | `rounded-3xl`    | `22px`            | 大型浮动表面             |
| 4X Large    | `--radius-4xl`  | `rounded-4xl`    | `26px`            | 极少数大型展示容器       |
| Full        | `--radius-full` | `rounded-full`   | Tailwind 极大半径 | 圆形按钮、胶囊、进度轨道 |

## 共享组件几何契约

组件契约优先组合现有语义 Token 与 Tailwind spacing Token，不为单一组件重复创建同值 CSS 变量。共享组件是尺寸的唯一实现所有者，调用方不得重新写死同一属性；只有需要随主题变化或被多个独立组件共同消费的语义，才提升为全局 CSS Token。

### Navigation Item

`NavigationItem` 是导航栏、设置侧栏和其他同类列表的统一基础。列表容器与组件共同遵循以下契约：

| 属性       | 正式 Token / utility             | 结果值               | 所有权           |
| ---------- | -------------------------------- | -------------------- | ---------------- |
| 文字字号   | `--font-size-body` / `text-body` | `14px`               | `NavigationItem` |
| 图标尺寸   | Tailwind spacing / `size-4`      | `16px`               | `NavigationItem` |
| 项目高度   | Tailwind spacing / `h-8`         | `32px`               | `NavigationItem` |
| 水平内边距 | Tailwind spacing / `px-2`        | 左右各 `8px`         | `NavigationItem` |
| 图文间距   | Tailwind spacing / `gap-1.5`     | `6px`                | `NavigationItem` |
| 项间距     | Tailwind spacing / `gap-1`       | `4px`                | 导航列表容器     |
| 圆角       | `--radius-lg` / `rounded-lg`     | `10px`               | `NavigationItem` |
| 选择颜色   | `--navigation-selection-*`       | 随主题与焦点状态变化 | `index.css`      |

固定高度通过 flex 居中形成图标上下各 `8px` 的光学留白，不再叠加垂直 padding。普通调用方只提供内容和状态，不覆盖上述几何；确有不同密度的场景应新增显式 variant，而不是散落 className 覆写。

### Select

`SelectTrigger` 是选择菜单宽度的唯一声明点，`SelectContent` 通过 Radix 的 `--radix-select-trigger-width` 自动与其等宽；调用方不得分别维护两份宽度。菜单项固定单行显示，超出既定宽度时截断，不根据运行时选项内容测量或改变整体布局。

| width     | Tailwind utility | 结果值               | 使用边界                           |
| --------- | ---------------- | -------------------- | ---------------------------------- |
| `compact` | `w-28`           | `112px`              | 工具栏、单位和短状态               |
| `default` | `w-44`           | `176px`              | 普通选择菜单，也是组件默认值       |
| `wide`    | `w-64`           | `256px`              | 较长但仍需固定布局的选项           |
| `full`    | `w-full`         | 父容器宽度           | 设置页、Dialog 与其他表单字段      |
| `fit`     | `w-fit`          | 当前选中内容固有宽度 | 明确允许宽度随当前值变化的特殊场景 |

普通调用方优先选择语义档位；只有布局边界无法由档位表达时才使用 `className` 覆盖宽度。所有模式保留 `max-width: 100%` 与视口可用宽度约束，避免 Trigger 或 Portal 菜单越界。

### Settings Dialog Surfaces

设置 Dialog 使用独立的表面语义，不再由组件直接借用 `background`、`muted` 或 `card` 推断层级。内容区是底层阅读画布，侧栏是中层导航表面；设置区块在亮色模式融入内容画布，在暗色模式浮于内容画布之上。明暗主题可以独立调整映射，不影响其他页面。

| 语义       | Token                                  | 使用边界                       |
| ---------- | -------------------------------------- | ------------------------------ |
| 主体表面   | `--settings-dialog-content-background` | 标题栏、设置内容与 Dialog 外层 |
| 导航栏表面 | `--settings-dialog-sidebar-background` | 设置分类导航栏                 |
| 区块表面   | `--settings-dialog-section-background` | 设置分组卡片                   |
| 分区边界   | `--settings-dialog-divider`            | 外框、侧栏右边界与标题栏下边界 |

主体始终使用应用公共 `background`，侧栏使用 Animate Tabs 容器的 `muted` 灰色。设置区块在亮色模式使用 `background`，仅以边界线组织内容；暗色模式改用 `muted`，在深色画布上保持清晰层级。这里只复用既有公共语义，不创建新的颜色值。

### Assistant Composer Surface

AI 助手输入卡片使用 `--assistant-composer-background` 隔离组件语义：亮色模式映射到 `background`，与应用主体融为一体；暗色模式映射到 `card`（`#262626`），在应用主背景 `#1d1e1f` 之上建立清晰输入层级。组件不得自行判断主题。

## 旧名称迁移

旧名称已从运行时代码和 `index.css` 删除；`check-architecture.mjs` 会阻止它们重新进入源码。

| 旧名称                             | 新语义                                           | 当前状态                                    |
| ---------------------------------- | ------------------------------------------------ | ------------------------------------------- |
| `--accent`（旧主色含义）           | `--primary`                                      | 冲突消费者已迁移；`--accent` 已恢复标准语义 |
| `--accent-strong`                  | `--primary-strong`                               | 已迁移                                      |
| `--accent-border`                  | `--primary-border`                               | 已迁移                                      |
| `--danger`                         | `--destructive`                                  | 已迁移                                      |
| `--success`                        | `--status-success`                               | 已迁移                                      |
| `--text-primary`                   | `--foreground`                                   | 已迁移                                      |
| `--text-secondary`                 | `--foreground-secondary` 或 `--muted-foreground` | 已迁移                                      |
| `--text-tertiary` / `--text-muted` | `--foreground-tertiary`                          | 已迁移                                      |
| `--app-bg`                         | `--surface-canvas`                               | 已迁移                                      |
| `--surface`                        | `--background` / `--card` / `--popover`          | 已按实际角色迁移并由架构门禁禁止回流        |
| `--theme-blue-rgb`                 | `--primary-rgb`                                  | 已迁移                                      |
| `--on-accent-rgb`                  | `--on-primary-rgb`                               | 已迁移                                      |
| `--neutral-ink`                    | `--neutral-ink-rgb`                              | 已迁移                                      |

## 迁移批次

1. 全局值源、Tailwind 映射与明暗模式所有权：已完成。
2. 应用 shell、导航栏、文稿列表和基础文字层级：已完成。
3. Button、Input、Dialog、Menu、Toast 等共享控件：已完成。
4. AI 助手普通布局、消息、diff 与图片表面：已完成。
5. CodeMirror、Markdown 与编辑器领域 palette：已完成；禅模式的作用域 palette 保留为领域数据。
6. 写作活动、空状态、表单、色板与共享动效默认值：已完成。
7. 删除兼容别名，并启用禁止普通 UI 新增裸色值的架构检查：已完成。
