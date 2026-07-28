# ADR 0011：有界写作 Agent Loop 与不确定写入恢复

日期：2026-07-27

## 状态

已接受

## 背景

Loby 已有八步模型/工具循环和 cancel channel，但原实现把每次 Provider attempt 都算作业务步骤。用户在模型生成中补充要求会取消当前 attempt，却仍消耗一步；连续引导可能在没有执行八轮工具的情况下触发上限。相同 `requestId` 还能覆盖既有控制句柄，使旧任务继续运行却无法再被取消。

另一个问题更危险：写工具获批后，客户端取消 future 不等于外部服务撤销写入。原实现会在任务返回时无条件删除 checkpoint，导致“外部写入是否已经发生”这一事实丢失。文档声明的整轮时限与单工具时限也没有在统一编排层落实。

## 开源实现对照

- [Codex protocol task model](https://github.com/openai/codex/blob/main/codex-rs/docs/protocol_v1.md) 区分 Task 与 Turn，并把完成、追加输入、interrupt、fatal error 和 approval 作为明确停止条件；
- [Codex app-server lifecycle](https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md) 要求每个 turn 以 completed/interrupted/failed 终结，每个 item 都有 started 到 completed 的权威生命周期；
- [OpenHands local conversation](https://github.com/OpenHands/software-agent-sdk/blob/main/openhands-sdk/openhands/sdk/conversation/impl/local_conversation.py) 使用独立 iteration 上限，并在最终迭代已经完成时避免错误覆盖 terminal status；
- [OpenCode session processor](https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/session/processor.ts) 显式追踪 abort、活跃 tool call 与 settle，避免终止后遗留悬挂工具状态。

Loby 不采用通用编码 Agent 的数百轮预算、后台 shell 或并行子任务。写作任务需要较小、可理解的循环上限，并优先保证作者能看清副作用是否发生。

## 决策

### 1. attempt 与完成步骤分离

Provider attempt 用于事件身份；只有模型返回确定结果后才消耗 Agent Loop 的八步预算。运行中 steer 取消当前 attempt、清除失效的 Provider continuation 和工具结果，并以新 attempt 重发，不计作已完成步骤。

### 2. 一个 requestId 只能拥有一个活动控制句柄

注册运行前原子检查 pending map。重复 `requestId` 立即拒绝，不能覆盖原任务的 cancel/steer sender；任务终止后再由对应 owner 清理。

### 3. 统一时间边界

整轮从 native Runtime 启动起最多 20 分钟，覆盖 MCP discovery、Provider 等待、审批和工具执行。每个工具另有 6 分钟上限，允许五分钟图片生成留出保存和协议处理余量。Provider 自身仍使用 ADR 0010 的连接、响应起始和 stream idle timeout。

### 4. 取消 future 不等于撤销副作用

写工具获批并开始后，将当前 run 标记为 `uncertain_write`。只有工具返回明确成功或失败才清除该标记。标记仍存在时发生取消、总超时或进程退出：

- 保留 `.loby/ai/runs/<requestId>.json`；
- 当前界面明确提示先检查目标状态；
- 重启后只提供显式恢复/放弃，不自动重放；
- read-only 工具和审批前取消不制造不确定写入。

## 非目标

- 不实现后台长期任务或无限循环；
- 不并行执行模型返回的多个工具；
- 不因超时自动重试写工具；
- 不把网络取消宣称为服务端事务回滚；
- 不把 steer 变成新的隐藏会话。

## 验证

- 两次相同 `requestId` 注册时第二次失败，原控制句柄仍存在；
- 多次 steer 增加 attempt identity，但不减少八步完成预算；
- MCP discovery、Provider、审批和工具均可由 cancel 或总时限结束；
- 普通工具超过六分钟返回失败结果，整轮超过二十分钟进入 failed；
- 写工具执行中取消/超时保留 checkpoint，已明确完成的工具允许正常清理；
- 所有 terminal path 只发出一种父运行终态，活动 item 被明确封口。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
