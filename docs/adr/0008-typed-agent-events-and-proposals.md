# ADR 0008：类型化 Agent 事件与文稿提案

日期：2026-07-27

## 状态

已接受

## 背景

Loby-owned Runtime 已经能连接 Provider、循环调用工具并发出运行事件，但早期实现仍有三个不可靠边界：Provider 的 SSE 被完整缓存后才返回，界面长期只能显示“请求模型”；正文操作依赖模型在 Markdown 回复里拼接协议块；运行活动又把 Provider 记账、reasoning、工具和回复塞进同一字符串数组，renderer 只能从中文标题与数组顺序猜测当前状态。

问题不在于缺少更大的 Agent 框架，而在于传输事件、工具提案和作者确认之间没有类型化契约。

## 开源实现对照

- [OpenAI Agents SDK](https://github.com/openai/openai-agents-js) 将模型、run item 与 raw response 分成类型化 stream event，并把需要批准的调用保存为 interruption 后再恢复 run；
- [OpenAI Responses streaming](https://developers.openai.com/api/docs/guides/streaming-responses) 和 [function calling](https://developers.openai.com/api/docs/guides/function-calling) 提供增量事件、严格 JSON Schema 与工具参数流的协议基线；
- [Vercel AI SDK](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage) 在 UI message 中保存 typed tool parts，并把 approval request/response 当作独立状态，而不是正文标记；
- [LangGraph interrupts](https://docs.langchain.com/oss/javascript/langgraph/interrupts) 与 [Mastra suspend/resume](https://mastra.ai/docs/workflows/suspend-and-resume) 证明长任务需要 checkpoint 后的中断恢复；
- [Rig](https://github.com/0xPlaygrounds/rig) 提供 Rust 多 Provider 与 streaming 抽象，但其 provider/tool 会话不能取代 Loby 的 ChatGPT subscription transport、写作上下文、作者审阅和本地文件权限。

这些项目适合作为协议与状态机参考，不适合整体接管 Loby Runtime：引入第二个 Node/Python runtime 会跨越 Tauri/Rust 的凭证和文件边界，且仍需重新实现 Loby 的文稿审阅。

## 决策

保留 Rust `Loby Agent Runtime`，把成熟框架的关键模式落实为 Loby 自己的稳定边界：

1. Provider 逐块消费 SSE，并归一化为 `ResponseStarted`、`TextDelta`、`ReasoningSummary`、`ToolInputStarted`；renderer 不接触厂商原始事件。
2. request-scoped bridge 使用 Agent Event Protocol v2：每个事件携带单调 `sequence`、`emittedAtMs`，活动携带 `activityKind`、`activityState`、`visibility`、`parentId`，运行状态通过独立 `state` 事件携带 `runPhase + activeItemId`。
3. Runtime 是 phase 与 item 生命周期唯一所有者。每个 started/queued/running item 必须收到 completed/failed/cancelled 终态；reasoning 使用稳定 ID，进入文本或工具阶段前显式封口；renderer 不再制造“生成回复”步骤。
   Provider 的 reasoning summary 是不可信展示输入：模型指令要求简体中文纯文本，native bridge 负责去除 Markdown、分隔粘连片段、限制长度，并在摘要不含中文时输出本地化兜底；原始英文摘要不进入新会话快照。
4. 折叠状态与展开轨迹是两套投影：折叠状态只读取 `runPhase`，展开轨迹过滤 `diagnostic`，只显示 `detail/milestone`。Provider request、SSE 记账、MCP discovery 与最终回复不计入用户步骤。
5. renderer 以一个 sequence-aware reducer 构造 `AgentRunInfo` v2 快照；实时消息和历史恢复共享终态不变量，应用重开时残留 running 快照必须转为 interrupted error。
6. request-scoped bridge 保持 proposal payload、文字、活动、usage、metric 与终态彼此独立。
7. 正文操作使用 `propose_insert_text`、`propose_create_sheet`、`propose_insert_image`、`propose_save_export`、`propose_document_change` 五个严格 schema 工具。
8. 提案工具的 effect 是 `proposal`：runtime 只校验并发出确认数据，不直接执行、不回填为已写入结果；同时向模型返回“该项卡片已记录”的非执行性工具回执并继续 Agent Loop，使多图片等复合任务能逐项提交全部提案。renderer 将其转换为 `AiAction` / `AiChangeSet`；同一消息、同一目标文稿中的多个待确认 `insertImage` 在此边界归一化为一个 `insertImages` 批量动作，以一张确认卡、一次正文 transaction 和一次撤销维持作者决策的原子性，已经执行的历史单图动作不做事后合并。
9. 新请求不再要求模型输出 `loby-action` / `loby-change`。旧解析器只用于历史会话兼容，并用行首闭合围栏避免正文内代码块截断外层 JSON。
10. 同一模型步骤只允许顺序工具调用；普通工具完成后才能在独立步骤提出文稿操作，避免执行副作用与作者提案混在一个不可恢复状态里。

## 明确不做

- 不引入任意 shell；
- 不让第三方 SDK 持有对话或写作库事实；
- 不把模型自然语言声明当作工具执行成功；
- 不引入数据库或自动重放副作用。跨应用重启的文件 checkpoint、显式重试与写工具防重复边界由 [ADR 0009](0009-durable-conversation-context.md) 承接。

## 验证

- SSE decoder 必须覆盖 chunk 边界、UTF-8 拆分、完成事件、工具参数与 Provider error；
- 结构化提案必须覆盖包含内层 Markdown 代码围栏的正文；
- 非提案工具仍经过既有审批与路径边界；
- proposal 到达后必须在同一消息生成确认卡片，未收到 proposal 时不得凭正文猜测动作；
- 单个 proposal 到达后不得提前结束整轮；模型仍有剩余文稿操作时必须继续产生独立 proposal，且已记录提案不得因回环而重复；
- 同轮同目标的多图提案在 renderer 中只能形成一个批量确认；全部锚点验证通过后才允许一次性写入，任一项失败时正文不得发生部分变化，成功后只出现一个回执和一个撤销入口；
- 完成、失败、取消必须封口所有可见活动。
- 录制事件回归必须覆盖纯文本、reasoning→tool、Skill→生图→proposal、审批接受/拒绝、错误、取消、迟到 sequence 与应用重开恢复。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
