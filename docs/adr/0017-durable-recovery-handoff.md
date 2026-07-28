# ADR 0017：持久的 Agent 恢复交接

日期：2026-07-28

## 状态

已接受

## 背景

Loby 不会在重启后继续一条已断开的 Provider stream，而是保留最小 run checkpoint，让作者决定放弃或以新轮次重试。这个方向正确，但首版恢复流先删除旧 checkpoint，再做上下文准备和新 Runtime 启动。任何一步失败或应用在窗口期退出，都会让恢复卡已消失、新 checkpoint 却尚未建立。

会话事实虽通过 latest-wins 队列与同目录原子 rename 保存，但仍只有一份 `conversations.json`。文件受外部同步、手动编辑或磁盘故障损坏时，读取端只能失败，不具备最近一份已验证历史。

## 开源对照

- [Codex app-server thread/turn 协议](https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md) 把 thread 持久化和 turn 生命周期分开，`turn/start` 先返回可定位的 turn，后续才流式发布 item 与 terminal。Loby 不复制 Codex rollout/thread store，但采用“先建立可恢复身份，再向 UI 承诺已启动”的时序。
- [Codex rollout recorder](https://github.com/openai/codex/blob/main/codex-rs/rollout/src/recorder.rs) 使用可重放的持久事件保存通用编码 Agent 轨迹。Loby 的会话是写作协作记录，不需要把每个 token 和工具 delta 变成无界 JSONL；完整会话 JSON + 有界 run checkpoint 更符合本地写作库的透明性。
- [OpenCode session processor](https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/session/processor.ts) 显式区分 pending/running/completed/error 的 tool part，并在输入相同时续接已有 tool call 身份。Loby 不对外部写入做不可证明的续接，而是把已开始但未得到确定结果的写工具标记为 uncertain，要求作者先检查外部状态。

## 决策

1. `start_agent_chat_stream` 在注册唯一 request control 后，同步原子写入初始 checkpoint；写入失败则撤销 control 并让 command 失败，不启动无持久证据的后台任务。
2. 恢复旧 request 时，native 先写入新 request checkpoint，成功后才删除旧记录。删除失败则尽力回滚新记录并拒绝启动，保留至少一份可见恢复证据。
3. renderer 只在 native 启动 command 返回成功后移除旧恢复卡。上下文规划、Skill 读取、附件提升或 IPC 启动失败时，旧 checkpoint 保持不变。
4. `waitingForApproval` 可以作为新轮任务安全重试，因为写工具尚未执行；`executingTool` 必须保留 uncertain 语义，新轮先检查目标状态。两者都不恢复旧 Provider stream 或自动重放工具。
5. 会话主文件和备份都必须是最多 64 MB 的 JSON array。写入新会话前，只有当现有主文件通过校验且内容发生变化时，才把它原子写入 `conversations.backup.json`。主文件损坏或缺失时可读备份；两者都损坏时报明确错误，不返回伪造的空历史。
6. 前端继续使用 500 ms latest-wins 串行保存队列，native 继续使用同目录 sync + rename；备份是额外防线，不代替既有时序保证。

## 明确不做

- 不在重启后续接旧 HTTP/SSE 连接或审批 channel；
- 不自动重放已获批的外部写工具；
- 不为了通用 Agent 的全量轨迹查询把写作应用迁移到无界事件日志或独立数据库；
- 不把备份当作新的正文事实源，Markdown 仍是唯一正文事实。

## 验证

- Rust 测试覆盖 checkpoint 先写新后删旧和显式放弃；
- 会话存储测试覆盖空库、往返、非数组拒绝与主文件损坏后的备份回退；
- renderer 恢复测试覆盖 waiting/executing 不同语义，TypeScript 类型检查保证 IPC supersession 参数一致；
- 最终仓库门禁覆盖完整 Agent Runtime 回归。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
