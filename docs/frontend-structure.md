# 前端工程结构

最后更新：2026-07-22

## 目标

Loby renderer 使用 feature-first 骨架，把“应用组合、产品能力、跨功能基础”分开，同时保持现有运行时、持久化和交互行为不变。

```text
src/
  main.tsx                 React 启动入口
  app/
    App.tsx                主窗口协调器与状态所有权
    AppRoot.tsx            主窗口/禅模式/主题工作室入口选择
  features/
    assistant/             AI 会话、执行、审阅与 composer
    design-gallery/        仅开发模式可见的共享组件与 Token 展示页
    editor/                CodeMirror、文稿信息、历史与资源
    library/               写作库、项目、文稿、字段与持久化
    publishing/            导出、墨问、微信与主题工作室
    settings/              设置对话框与面板
    writing-activity/      写作目标与活动记录
    zen-mode/              禅模式窗口、保存与声音
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
- `shared` 不得导入 `app` 或具体 feature。只被单一 feature 使用的代码应留在该 feature。
- 历史 feature 间依赖在本次路径迁移中保持显式，不借工程整理改写状态机。新增协作优先抽出真正共享的契约，或提升到 `app` 协调。
- 每个 feature 只创建真实使用的 `components/`、`hooks/`、`model/`、`constants/`；不使用 `.gitkeep` 维持空骨架。
- tests 与被测文件 colocate，路径变化不得改变测试发现规则。

## 高风险边界

- `src/app/App.tsx` 仍拥有顶层选择、持久化与主要工作区状态。继续拆分前先为目标状态边界补 integration coverage。
- editor 的中文 IME、selection/cursor、Markdown decorations 和长文性能不因目录整理而改变。
- AI 消息历史、运行流、编辑器 diff 与发布主题助手保持各自状态所有权，不为减少文件长度合并或迁移。
- 主助手上下文由紧凑的落笔操作契约、稳定写作快照和每轮显式 Skill/资源组成；不得把全局 Codex Skill 目录、Memory 或重复动作协议默认塞入每次首轮请求。
- 写作库目录和 Markdown 是事实来源；外部文件刷新、保存队列、选择修复与回收站规则保持现有顺序。
- `src/features/publishing/model/wechatThemes.ts` 是公众号主题 registry；发布秘密只进入 native secret store。

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
