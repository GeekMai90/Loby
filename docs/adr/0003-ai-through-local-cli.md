# ADR 0003：优先通过本地 CLI 集成 AI

日期：2026-07-08

## 状态

已接受

## 背景

Loby 要把 Codex 式工作流变得更适合写作者，同时保留本地项目控制权。产品定位是带 AI 协作者的写作应用，不是托管式 AI 编辑器。

## 决策

使用本地 Codex CLI 作为首个 AI 执行层，并通过长生命周期 app-server runtime 集成。实验性 provider 接线留在内部；除非另一个 provider 已定义会话模型，并在模型、审批、skill、用量和失败处理上形成清晰对等能力，否则不向用户暴露 provider selector。

## 影响

- 用户可以检查和配置 Codex CLI 路径；
- CLI 探测与诊断属于应用设置体验；
- Claude 与 hosted API 必须作为完整的新 provider 设计，不能成为半支持选项；
- 审批、取消与运行活动需要持久、明确的界面状态；
- 未来 hosted provider 不得静默替换本地执行。
