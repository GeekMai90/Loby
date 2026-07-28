# ADR 0015：封口 Agent 事件与稳定活动身份

日期：2026-07-27

## 状态

已接受

## 背景

Agent Event Protocol v2 已有 sequence、phase、typed activity 与 terminal，但首版 reducer 仍留下三个缝隙：它只拒绝较小 sequence，终态后携带更大 sequence 的迟到回调仍能改写 phase；同一活动更新会被移到数组末尾，完成事件因此改变用户看到的步骤顺序；兼容层还会给 typed reasoning 重写 item id，使 `activeItemId` 不能稳定指向活动。

这些不是视觉排序细节。折叠摘要、展开轨迹和持久化快照若使用不同身份或可被终态后事件重新打开，同一次运行会出现互相矛盾的事实。

## 开源实现对照

- [Codex app-server protocol](https://github.com/openai/codex/blob/main/codex-rs/docs/protocol_v1.md) 以 turn/item started、delta、completed 事件表达生命周期，客户端通过稳定 item identity 更新同一对象。
- [OpenCode session processor](https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/session/processor.ts) 将 tool part 从 pending/running 推进到 completed/error，再决定会话是否继续。
- Loby 不需要复制编码 Agent 的全部 item 种类或展示原始 reasoning；写作界面只需要少量、稳定、面向作者的 milestone/detail，并保证已结束的对话事实不再漂移。

## 决策

1. Rust 原生事件 `kind` 使用封闭 `AgentStreamEventKind`，拼写错误不能编译；Provider 原始事件仍只存在于 adapter 内。
2. 新 typed event 的 `itemId` 原样进入 renderer，`run.activeItemId` 与活动身份保持同一命名空间。稳定别名只服务缺少 typed kind 的旧会话。
3. 活动按首次出现的位置原位更新；状态变化不再改变步骤顺序。
4. 非 reasoning 活动到达 completed/failed/cancelled 后，不接受回到 queued/running/awaitingApproval 或改成另一终态。reasoning 是刻意聚合的单行进度，可在多次模型步骤间恢复 running，避免写作长任务重复显示多个“思路已整理”。
5. run 到达 completed/error/cancelled 后成为封口快照；无论迟到事件 sequence 大小，reducer 均不再改写。IPC listener 同时在终态后忽略已排队 callback，防止正文 delta、proposal 或 artifact 绕过 reducer 追加。
6. 持久化时仍处于 running 的快照在加载边界转为 interrupted error，不尝试恢复隐藏 Provider stream。

## 明确不做

- 不展示 Provider 的完整原始事件树；
- 不为每次 reasoning fragment 创建一行重复步骤；
- 不依赖事件标题、数组最后一项或动画状态推断当前 phase；
- 不在 renderer 自动修复 native 发出的非法新协议，只拒绝并由测试暴露。

## 验证

- reducer 测试覆盖较小和较大 sequence 的终态迟到事件；
- typed `activeItemId` 与 activity id 一致，legacy 事件仍保留兼容别名；
- activity 测试覆盖原位更新、非 reasoning 终态防回退和 reasoning 聚合恢复；
- Rust 事件序列化、Clippy、前端事件定向测试和 TypeScript typecheck 通过。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
