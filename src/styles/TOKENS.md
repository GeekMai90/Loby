<!--
[INPUT]: 依据 index.css 的实际 Token 契约与各 stylesheet 的当前消费关系
[OUTPUT]: 提供 Token 命名边界、源码颜色审计规则、领域裸色边界、旧名称迁移台账与分阶段改造顺序
[POS]: styles 的设计系统导航文档；解释语义与迁移状态，具体值始终以 index.css 为唯一事实来源
[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
-->

# Loby 语义 Token 台账

## 所有权

- `index.css` 保存应用全局 Token 的明暗值；其他文件只消费，不重复定义全局主题。
- `shadcn.css` 只把语义 Token 映射为 Tailwind utilities。
- `themes.css` 和 `settings-controls.css` 可以在明确作用域内维护 editor palette。
- 发布输出主题、用户持久化颜色和测试 fixture 是领域数据，不进入应用全局 Token；出现在应用 UI 中的 AI/渠道品牌色仍须进入全局 Token。

## 核心语义

| 语义           | Token                                                              | 使用边界                                  |
| -------------- | ------------------------------------------------------------------ | ----------------------------------------- |
| 应用背景与正文 | `--background` / `--foreground`                                    | 页面背景与默认文本                        |
| 卡片与浮层     | `--card` / `--popover`                                             | 分组卡片与非菜单浮层                      |
| 专用背景       | `--background-canvas` / `--background-soft` / `--background-hover` | 下沉画布、柔和底色与内容悬停背景          |
| 主要操作       | `--primary` / `--primary-foreground`                               | system blue 操作、激活选择与焦点          |
| 柔和交互       | `--accent` / `--accent-foreground`                                 | hover、菜单 active 等中性表面，不表示主色 |
| 次级信息       | `--muted` / `--muted-foreground`                                   | 次级背景与辅助文字                        |
| 边界与焦点     | `--border` / `--input` / `--ring`                                  | 控件边框、输入边界与键盘焦点              |
| 图标按钮       | `--button-icon-foreground` / `--button-icon-hover-background`      | ghost 图标按钮的默认文字与悬停表面        |
| 状态反馈       | `--destructive` / `--status-success` / `--status-warning`          | 删除、成功与警告                          |
| 状态辅助       | `--status-success-foreground` / `--status-warning-soft`            | 状态前景与低对比提示表面                  |
| 收藏状态       | `--status-favorite`                                                | 收藏星标，不借用警告色语义                |
| AI 品牌        | `--brand-anthropic`                                                | 连接管理中的 Anthropic 品牌识别           |
| 发布渠道       | `--brand-wordpress` / `--brand-wordpress-soft`                     | WordPress 渠道识别与柔和底色              |
| 发布预览       | `--publishing-preview-*` / `--publish-loader-*`                    | 固定亮色预览画布与发布加载插画            |

亮色状态色以主操作 `#3F8FFF` 为感知基准：成功 `#31AC59`、警告 `#C97F00`、危险 `#E3635E` 使用接近的 OKLCH 明度并略低于主操作彩度，使四种操作与反馈颜色保持同一视觉重量；暗色状态色独立映射，不受这组亮色值约束。

暗色模式的 `card` 使用比 `background` 略亮的中性灰 `#262626`，建立稳定分组层级；它与当前 `muted` 只保持同值，不互相引用，避免两个语义随任一方调整而意外耦合。`popover` 直接持有暗色浮层值，保持浮层与长期内容容器的语义差异，不再经过含糊的中间层级别名。

背景颜色统一使用 `background` 命名。透明背景直接通过 `color-mix()` 从 `--background` 派生，不保留与其同值的 RGB 通道；确实具有独立明暗值的画布、柔和底色和悬停背景分别使用 `--background-canvas`、`--background-soft` 与 `--background-hover`。组件专属背景使用 `--{component}-background`，玻璃菜单使用更明确的 `--menu-glass-background`。

亮色 `--neutral-ink-rgb` 只承担透明度计算，其通道必须与主文字 `--foreground` 的 `#303032` 保持一致，不再引入独立的 `#3C3C43` 近似黑；暗色模式仍可根据暗色材质的透明叠加需要独立映射。

Context Menu、Dropdown Menu、Select 与编辑器实体菜单统一消费 `--menu-background`，并直接映射应用 `background`；菜单依靠边框和阴影建立浮层层级，不借用 `popover` 改变底色。亮色菜单的文字与图标使用 `#303032`，hover 使用 `#F4F4F4` 中性表面和应用 `foreground`；暗色菜单的文字与图标使用 `#E3E5E7`，hover 使用 `#27272A` 中性表面和应用 `foreground`。

Tooltip 属于非菜单浮层，表面与文字消费 `popover` / `popover-foreground`，因此亮色模式保持亮色浮层、暗色模式保持暗色浮层；快捷键 keycap 消费 `muted` 与公共边界语义，不另建一套主题色。

AI 变更审阅的新增与删除行分别消费 `--assistant-diff-added-bg`、`--assistant-diff-removed-bg`；暗色模式从 `status-success`、`destructive` 与 `card` 混合低对比背景。AI 操作卡片的警告边框、背景和文字统一消费 `--status-warning`，不再使用 Tailwind 固定 amber 色阶。

## 颜色审计

开发态“颜色系统”页面以 `features/design-gallery/colorAudit.ts` 为只读审计模型，直接扫描 `index.css` 和当前 renderer 源码，不维护另一份手写色值表。Light 与 Dark 均按“表面、边界、文字、操作与状态”的相同顺序列出带中文名称和主次层级的核心 UI 语义，再分别按浏览器解析后的实际色值去重并列出全部语义别名；阴影、渐变和滤镜必须独立于颜色卡片。每次打开时同时呈现：

- 全部明暗语义颜色、基础 RGB 通道、渐变、阴影与滤镜材质 Token；每项标注直接引用、别名链路和源码位置。
- 普通 UI 中仍存在的 HEX、numeric color function 与 Tailwind 固定 palette；这些结果必须为零。
- 编辑器主题、专注模式、项目/属性用户颜色和发布内容主题中的领域裸色；它们必须标注文件与用途，不能被误迁成应用主题。
- 产品源码未使用的 Token、明暗模式完全同值组，以及 RGB 距离不超过 12 的近似色候选。

左侧导航玻璃背景使用的 `--sidebar-glass-*` 与右下角 AI 助手启动按钮使用的 `--assistant-launcher-*` 属于独立视觉作品，不代表普通应用界面的可复用 palette。它们继续由 `index.css` 集中持有，但从颜色系统色卡、重复色和近似色候选中排除，也不参与普通颜色的替换决策。

“同值”与“近似”只代表值得复核，不代表可以自动合并。`card` / `muted`、`background` / 固定发布预览白色等即使当前同值，也可能具有不同主题生命周期；只有语义、消费者和变化原因一致时才能合并。普通 UI 裸色门禁由 `scripts/check-architecture.mjs` 覆盖全部 Tailwind palette，而不再只检查 `black` / `white`。

零引用治理以完整依赖链为准：只有同时不存在源码引用、Tailwind utility 消费和被使用 Token 的间接依赖时，才删除明暗声明、框架映射与局部作用域覆写。颜色系统必须把清理后的零结果显式显示为“未使用 Token 已清零”，避免空白区域被误读为审计失效。

## 字体尺度

应用界面只使用以下六级字号。`13px` 是默认 UI 基尺寸，普通组件不得引入列表之外的中间字号；`24px` 是应用界面上限，不约束编辑器正文与发布内容的用户可配置字号。

| 语义     | Token                  | Tailwind utility | 字号   | 使用边界                                      |
| -------- | ---------------------- | ---------------- | ------ | --------------------------------------------- |
| 辅助信息 | `--font-size-caption`  | `text-caption`   | `12px` | 时间、状态、说明与次要元数据                  |
| 基础界面 | `--font-size-base`     | `text-app-base`  | `13px` | 按钮、输入、菜单、切换和日期等默认交互文字    |
| 阅读正文 | `--font-size-body`     | `text-body`      | `14px` | 导航项、正文、Dialog 说明与需要连续阅读的内容 |
| 分组标题 | `--font-size-subtitle` | `text-subtitle`  | `16px` | 面板标题与重要分组标题                        |
| 页面标题 | `--font-size-title`    | `text-title`     | `18px` | 页面标题与主要内容标题                        |
| 展示标题 | `--font-size-display`  | `text-display`   | `24px` | 强调标题；应用界面最大字号                    |

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

## 阴影四级候选

设计系统保留 Subtle、Raised、Overlay 与 Focus 四级基础展示；标准浮层已经按确认结果采用 Smooth Shadow 式多层衰减，Dialog 作为 Overlay 的更高海拔变体。Subtle 对应输入框、消息气泡和 Chip 的轻微分离；Raised 对应卡片、工具条和普通浮层；Overlay 对应菜单与 Toast；Focus 使用 Primary ring 表达键盘焦点和选中确认。玻璃材质、拖拽反馈、AI 启动按钮与插画阴影属于独立视觉效果，不强行并入普通 elevation。

| 层级    | 当前候选来源                                  | 使用边界               |
| ------- | --------------------------------------------- | ---------------------- |
| Subtle  | `--form-field-shadow`                         | 输入框、消息气泡、Chip |
| Raised  | `--elevation-raised-shadow`                   | 工具条、普通浮层       |
| Overlay | `--menu-solid-shadow-ring` / `--toast-shadow` | 菜单、Toast            |
| Dialog  | `--dialog-shadow-ring`                        | Dialog、AlertDialog    |
| Focus   | `ring-3 ring-primary/20`                      | 键盘焦点、选中确认     |

标准 Raised、Overlay 与 Dialog 阴影采用 Smooth Shadow 式多层低透明度衰减；Overlay/Dialog 的装饰性 1px 边缘作为最后一层阴影绘制，避免与独立 border 形成双边缘。玻璃菜单、拖拽预览、AI launcher 与发布预览仍保留各自的材质和方向性阴影，不套用这组标准海拔。

## 共享组件几何契约

组件契约优先组合现有语义 Token 与 Tailwind spacing Token，不为单一组件重复创建同值 CSS 变量。共享组件是尺寸的唯一实现所有者，调用方不得重新写死同一属性；只有需要随主题变化或被多个独立组件共同消费的语义，才提升为全局 CSS Token。

### Control Typography

共享可操作控件的可见文字统一消费 `--font-size-base` / `text-app-base`，结果值为 `13px`。该契约覆盖 `Button` 全部尺寸、`Input`、`Textarea`、`SelectTrigger` 与菜单条目、`Toggle` / `ToggleGroup`、`TabsTrigger` 以及 Calendar 的月份和日期按钮；调用方只在内容明确属于标题、连续阅读正文或辅助元数据时改用其他语义字号，不得用 `text-sm`、`text-base` 或裸 `13px` 重新声明默认控件文字。

`Dialog` / `AlertDialog` 的操作按钮仍通过 `Button` 使用 13px；标题和说明分别消费标题、正文 Token，不因位于共享组件目录而被误归类为控件文字。菜单分组标签、快捷键和 Calendar 星期标题属于辅助信息，使用 `text-caption` 12px。

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

`SelectTrigger` 与菜单项统一使用 `text-app-base` 13px；Trigger 是选择菜单宽度的唯一声明点，`SelectContent` 通过 Radix 的 `--radix-select-trigger-width` 自动与其等宽。调用方不得分别维护两份宽度；菜单项固定单行显示，超出既定宽度时截断，不根据运行时选项内容测量或改变整体布局。

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
| 行分隔线   | `--settings-dialog-row-divider`        | 设置卡片内左右缩进的浅色分隔线 |

主体始终使用应用公共 `background`，侧栏使用 Animate Tabs 容器的 `muted` 灰色。设置区块在亮色模式使用 `background`，仅以边界线组织内容；暗色模式改用 `muted`，在深色画布上保持清晰层级。卡片内部行分隔线由分区边界与透明色混合派生，在保持同一色相的同时弱化层级；这里只复用既有公共语义，不创建新的裸色值。

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
| `--app-bg`                         | `--background-canvas`                            | 已迁移                                      |
| `--surface`                        | `--background` / `--card` / `--popover`          | 已按实际角色迁移并由架构门禁禁止回流        |
| `--surface-rgb`                    | 直接从 `--background` 使用 `color-mix()` 派生    | 同值通道已删除                              |
| `--surface-canvas`                 | `--background-canvas`                            | 已迁移                                      |
| `--surface-soft`                   | `--background-soft`                              | 已迁移                                      |
| `--surface-tint`                   | `--popover`                                      | 单一消费者已内联                            |
| `--surface-hover`                  | `--background-hover`                             | 已迁移                                      |
| `--toast-surface`                  | `--toast-background`                             | 已迁移                                      |
| `--menu-surface`                   | `--menu-glass-background`                        | 已按玻璃菜单真实职责迁移                    |
| `--editor-floating-surface*`       | `--editor-floating-background*`                  | 编辑器作用域 palette 已迁移                 |
| `--theme-blue-rgb`                 | `--primary-rgb`                                  | 已迁移                                      |
| `--on-accent-rgb`                  | `--on-primary-rgb`                               | 已迁移                                      |
| `--neutral-ink`                    | `--neutral-ink-rgb`                              | 已迁移                                      |

## 迁移批次

1. 全局值源、Tailwind 映射与明暗模式所有权：已完成。
2. 应用 shell、导航栏、文稿列表和基础文字层级：已完成。
3. Button、Input、Dialog、Menu、Toast 等共享控件：已完成。
4. AI 助手普通布局、消息、diff 与图片表面：已完成。
5. CodeMirror、Markdown 与编辑器领域 palette：已完成。
6. 写作活动、空状态、表单、色板与共享动效默认值：已完成。
7. 删除兼容别名，并启用禁止普通 UI 新增裸色值的架构检查：已完成。
