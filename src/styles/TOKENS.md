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

| 语义           | Token                                                     | 使用边界                                  |
| -------------- | --------------------------------------------------------- | ----------------------------------------- |
| 应用背景与正文 | `--background` / `--foreground`                           | 页面背景与默认文本                        |
| 浮层与容器     | `--card` / `--popover` / `--surface*`                     | 面板、卡片、菜单及层级表面                |
| 主要操作       | `--primary` / `--primary-foreground`                      | system blue 操作、激活选择与焦点          |
| 柔和交互       | `--accent` / `--accent-foreground`                        | hover、菜单 active 等中性表面，不表示主色 |
| 次级信息       | `--muted` / `--muted-foreground`                          | 次级背景与辅助文字                        |
| 边界与焦点     | `--border` / `--input` / `--ring`                         | 控件边框、输入边界与键盘焦点              |
| 状态反馈       | `--destructive` / `--status-success` / `--status-warning` | 删除、成功与警告                          |

## 字体尺度

应用界面只使用以下六级字号。`13px` 是默认 UI 基尺寸，普通组件不得引入列表之外的中间字号；`24px` 是应用界面上限，不约束编辑器正文与发布内容的用户可配置字号。

| 语义     | Token                  | Tailwind utility | 字号   | 使用边界                       |
| -------- | ---------------------- | ---------------- | ------ | ------------------------------ |
| 辅助信息 | `--font-size-caption`  | `text-caption`   | `12px` | 时间、状态、说明与次要元数据   |
| 基础界面 | `--font-size-base`     | `text-app-base`  | `13px` | 导航、菜单、按钮与默认 UI 文字 |
| 正文控件 | `--font-size-body`     | `text-body`      | `14px` | 正文、输入与主要控件文字       |
| 分组标题 | `--font-size-subtitle` | `text-subtitle`  | `16px` | 面板标题与重要分组标题         |
| 页面标题 | `--font-size-title`    | `text-title`     | `18px` | 页面标题与主要内容标题         |
| 展示标题 | `--font-size-display`  | `text-display`   | `24px` | 强调标题；应用界面最大字号     |

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
