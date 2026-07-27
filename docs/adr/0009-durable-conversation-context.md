# ADR 0009：持久会话事实与有界模型视图

日期：2026-07-27

## 状态

已接受

## 背景

早期 Loby 会把最后 8 条消息格式化为一段 `最近对话` 文本，再连同当前文稿一起塞进本轮 user prompt。界面虽然保存了完整历史，模型却只能看到约四轮扁平文本；角色、待确认动作、正文变更、生成产物和附件身份都会丢失。继续增大固定条数只能推迟溢出，不能建立可靠的多轮 Agent。

同时，历史附件来自进程临时目录，应用重开后无法复用；编辑旧消息会直接截断后续消息；原生写工具审批只存在于内存 channel。三者本质相同：把长期事实与一次运行的临时投影混在了一起。

## 开源实现对照

- [Codex compaction](https://github.com/openai/codex/blob/main/codex-rs/core/src/compact.rs) 将完整线程与发给模型的压缩上下文分开，并根据 token 使用触发压缩；app-server 另外提供 compact 与 rollback 线程操作；
- [OpenHands condenser](https://github.com/OpenHands/software-agent-sdk/tree/main/openhands-sdk/openhands/sdk/context/condenser) 以 append-only events 保存事实，由 View 决定模型可见范围；Condensation event 标记被折叠事件并插入摘要；
- [OpenCode compaction](https://github.com/sst/opencode/blob/dev/packages/opencode/src/session/compaction.ts) 在溢出前裁剪旧工具输出并生成包含目标、约束、发现、完成情况和文件状态的结构化交接摘要。

Loby 借鉴的是这些状态与投影模式，不引入它们的 Node/Python runtime，也不把写作库、作者审阅或 Provider 账号交给第三方框架。

## 决策

### 1. 完整事实与模型视图分离

`.loby/ai/conversations.json` 保存完整消息、动作、变更、运行成果、分支关系与压缩检查点。Conversation Context Planner 每轮重新派生 Provider model view；压缩只改变投影，不删除原消息。

Planner 按模型的保守 context window 预留输出与工具空间，估算稳定写作上下文、当前 prompt 和历史 token。最近完整 turn 以原生 `user` / `assistant` 角色发送；system 记录不得伪装成 Provider system message。

### 2. 结构化压缩检查点

超出历史预算时，较早消息生成可持久化 checkpoint，至少保留：

- 用户目标、约束与明确决定；
- 已有结论；
- 待确认/已执行动作、正文变更状态；
- 生成产物路径与来源身份；
- 被压缩和仍完整保留的消息 ID。

checkpoint 是可见、可审计的模型投影。界面展示最近一次估算使用量和压缩消息数；完整聊天历史始终可读。

### 3. 附件成为写作库受管事实

composer 文件先进入进程临时目录。发送前 native 按 SHA-256 提升到 `.loby/ai/attachments/<hash>/`，会话只保存稳定路径、名称、MIME、类型与大小，不保存 blob URL。Provider 只允许读取当前进程临时根或当前写作库受管根，拒绝任意历史绝对路径。

### 4. 编辑创建分支

编辑历史 user message 创建新的 `ChatConversation`，记录 `parentConversationId` 与 `forkedFromMessageId`，复制分叉点之前的事实并从编辑后的消息继续。原会话不截断、不覆盖；历史菜单同时保留原线与分支。

### 5. 未完成运行使用显式恢复日志

Runtime 在 `.loby/ai/runs/<requestId>.json` 保存最小 checkpoint：会话、Provider、原始用户意图、运行阶段、工具名与风险说明。正常终态清除文件；进程中断才留下恢复项。

重启后恢复项显示为继续/拒绝卡片，但不得直接续跑隐藏 Provider state：

- 中断在写工具审批前，明确说明工具尚未执行，用户确认后作为新一轮重试；
- 中断在写工具开始后，必须先提示检查外部状态，再由用户明确决定是否重试；
- 永不自动重放写操作、MCP 副作用或发布动作。

这比伪造“精确续跑”更符合本地写作工具的作者控制权；未来只有工具提供稳定 idempotency key 时，才允许对单个工具增加精确 continuation。

## 验证

- 20 个以上 turn 在小窗口预算下触发压缩，首轮长期约束仍进入 checkpoint；
- OpenAI 与 Anthropic adapter 收到真实角色消息，未知/system 角色被拒绝；
- pending action、change set 与 artifact 进入后续轮模型视图；
- checkpoint 输入未变化时复用，切换小窗口模型时重新规划；
- 受管附件跨保存/加载保留，blob 预览和临时目录记录不落盘；
- 编辑旧消息产生新分支且源会话字节语义不变；
- run checkpoint 正常终态删除，中断项只能经显式确认恢复，`executingTool` 必须展示防重复写入警告。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
