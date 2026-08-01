# 前端工程结构

最后更新：2026-07-31

## 目标

Loby renderer 使用 feature-first 骨架，把“应用组合、产品能力、跨功能基础”分开，同时保持现有运行时、持久化和交互行为不变。

```text
src/
  main.tsx                 React 启动入口
  app/
    App.tsx                主窗口协调器与状态所有权
    AppRoot.tsx            主窗口/主题工作室入口选择
  features/
    app-update/            Tauri 更新检查、下载/安装进度与重启
    assistant/             AI 会话、执行、审阅与 composer
    design-gallery/        仅开发模式可见的共享组件与 Token 展示页
    editor/                CodeMirror、文稿信息、历史、资源与专注布局
    library/               写作库、项目、文稿、字段与持久化
    publishing/            导出、墨问、微信与主题工作室
    settings/              设置对话框与面板
    writing-activity/      写作目标与活动记录
  shared/
    components/            跨功能 UI
    hooks/                 跨功能 React/platform hooks
    lib/                   无领域偏向的工具与适配
    constants/             跨功能稳定配置
    types.ts               renderer 共享领域契约
  components/
    ui/                    shadcn/ui primitives
    animate-ui/            可选 Animate UI primitives
  styles/                  tokens、reset 与复杂视觉例外
  assets/                  renderer 静态资产
  styles.css               样式 import entrypoint
```

## 依赖与所有权

- 主方向是 `app → features → shared`。`app` 组合 feature 并保留跨功能状态与持久化所有权。
- `app-update` 持有 updater 生命周期；library footer 只接收是否可更新、进度和动作回调，安装前写作队列 flush 由 `app` 协调。
- `shared` 不得导入 `app` 或具体 feature。只被单一 feature 使用的代码应留在该 feature。
- 历史 feature 间依赖在本次路径迁移中保持显式，不借工程整理改写状态机。新增协作优先抽出真正共享的契约，或提升到 `app` 协调。
- 每个 feature 只创建真实使用的 `components/`、`hooks/`、`model/`、`constants/`；不使用 `.gitkeep` 维持空骨架。
- tests 与被测文件 colocate，路径变化不得改变测试发现规则。

## 高风险边界

- `src/app/App.tsx` 仍拥有顶层选择、持久化与主要工作区状态。继续拆分前先为目标状态边界补 integration coverage。
- editor 的中文 IME、selection/cursor、Markdown decorations 和长文性能不因目录整理而改变。
- AI 消息历史、编辑器 diff 与发布主题状态保持各自所有权；主助手与发布主题助手共享 Assistant Runtime、连接目录、Composer 和通用上下文规划，但不合并领域会话持久化或结果协议。
- 写作库目录和 Markdown 是事实来源；外部文件刷新、保存队列、选择修复与回收站规则保持现有顺序。
- `src/features/publishing/model/wechatThemes.ts` 是公众号主题 registry；发布秘密只进入 native secret store。

## 启动与加载边界

- 首屏同步 JavaScript 只承载应用骨架、写作库恢复和主要导航；CodeMirror 编辑器内核是独立异步 chunk，有上次文稿时在首轮提交后主动预加载，没有文稿时不进入首次启动链路。
- 编辑器异步挂载必须保留待处理的聚焦文稿 ID，并继续通过 `onCreateEditor` 兑现焦点；不能因分包改变文稿 authority、IME、selection 或保存时序。
- 默认目录、当前写作库和 AI 会话等互不依赖的本地读取并行启动；非首屏发布目标必须等真实写作库路径恢复后加载，启动占位状态不得发起 native IPC。
- `scripts/check-bundle-size.mjs` 同时限制 `dist/index.html` 静态引用的初始 JavaScript 总量和最大动态 chunk，新增 lazy import 不能只移动体积而失去整体预算。

## 样式与 UI 基础

- 普通布局、状态与控件优先 Tailwind CSS 4 + shadcn/ui。
- `src/components/ui/` 与 `src/components/animate-ui/` 是基础源码，不承载产品领域状态。
- `src/styles.css` 只导入 `src/styles/` 文件；自定义 CSS 只用于 tokens/reset、shell geometry、liquid glass、CodeMirror、rich Markdown、diff、drag/drop、image lightbox、publishing preview 和状态动画等明确例外。
- keyboard shortcuts 位于 `src/shared/lib/keyboardShortcuts.ts`；theme 元数据与持久化规则位于 `src/shared/constants/themes.ts`、`src/shared/lib/themes.ts` 和 `src/styles/themes.css`。

## 下一步

1. 先观察新目录在日常功能开发中的依赖方向，不立即增加 barrel exports 或强制 public API 层。
2. 只在有稳定测试边界时继续拆 `App.tsx`；优先考虑 library session 或其他可独立验证的 coordinator。
3. feature 间出现重复依赖时先判断它是共享契约、上层编排还是领域所有权错误，不能机械搬入 `shared`。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
