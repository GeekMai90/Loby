# ADR 0012：会话检查点按语义失效

日期：2026-07-27

## 状态

已接受

## 背景

ADR 0009 已经把完整会话事实与 Provider model view 分开，但首版 checkpoint 只比较被压缩和保留的消息 ID。Loby 的动作、change set 和运行产物会在原消息上更新状态；消息 ID 不变不代表模型可见语义不变。用户确认插入后，旧 checkpoint 仍可能告诉模型动作处于 `proposed`。

首版投影还只保存动作标题/状态与变更摘要。对写作协作而言，“有一个待插入动作”不足以继续任务；模型至少需要知道待插入的内容与目标，或 change set 的有界提议正文。

## 开源实现对照

- [Codex compaction](https://github.com/openai/codex/blob/main/codex-rs/core/src/compact.rs) 将压缩结果与实际线程上下文关联，并在后续 turn 继续携带结构化 item；
- [OpenHands condenser](https://github.com/OpenHands/software-agent-sdk/tree/main/openhands-sdk/openhands/sdk/context/condenser) 以 event view 决定模型可见事实，状态事件是上下文本身而非消息数量的附属信息；
- [OpenCode compaction](https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/session/compaction.ts) 在摘要中明确保留目标、约束、进度和文件状态。

Loby 不引入额外模型调用来总结每次聊天。写作会话的关键状态结构化程度足够高，优先使用确定性投影，保持本地、快速、可测试。

## 决策

1. checkpoint 在来源消息 ID 和保留消息 ID 之外，保存 `sourceFingerprint`；它由角色、消息正文、附件摘要、动作/变更状态与产物路径的模型可见投影计算。
2. 旧 checkpoint 没有指纹时自动失效并重建；不修改或删除原聊天事实。
3. 动作 payload 只提取 `target/title/text/markdown/body/content/path/alt/filename` 等已知写作字段，并逐字段限制长度。
4. change set 投影携带有界 `proposedBody`，同时保留 summary 与 status。
5. 长单行摘要采用头尾保留，避免把写在句尾的硬约束总是截掉；总输入仍由 Planner 的 token budget 二次裁剪。

## 验证

- 同一组消息和状态复用同一个 checkpoint；
- 相同消息 ID 下 action status 或 payload 改变会生成新指纹并重建；
- pending insert 的文本/目标与 change set 的提议正文进入最近 turn 和压缩摘要；
- 旧 checkpoint 缺失指纹时重建；
- 总估算输入不超过 Planner 输入预算，完整本地消息不被改写。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
