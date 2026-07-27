# AI 集成

## 产品角色

Loby 的 AI 是写作协作者，不是整篇代写器。它可以回答问题、分析结构、局部润色、提出修改和准备发布内容，但作者始终决定是否把结果写进正文。Markdown 与写作目录仍是内容的唯一事实来源。

## Loby Agent Runtime

Agent Runtime 位于 Tauri/Rust 原生层。renderer 只持有界面状态、可见对话与作者审阅，不直接连接模型、保存凭证或执行工具。

```text
React assistant UI
  -> Loby request/event IPC
  -> Agent Runtime
       -> Provider Registry
       -> Agent Loop
       -> Context Builder
       -> Tool Registry
            -> Local Markdown tools
            -> Web search
            -> Image generation
            -> Skill loader
            -> MCP client
       -> Permission Controller
       -> Credential Store
  -> request-scoped typed stream / proposal events
  -> conversation / review / action cards
```

运行时拥有任务的编排和停止条件，但不重新实现标准协议。HTTP 与 MCP transport 使用受控第三方库；AI、OAuth 与 MCP 凭证由原生层写入当前用户私有的落笔 app-config，启动不访问系统 Keychain。ChatGPT 账号 Provider 使用 Device OAuth，后续其他账号 Provider 只有在授权边界可验证时才引入 OAuth PKCE 或 device flow。第三方库不能拥有 Loby 的对话历史、写作上下文、修改审阅或权限政策。

### 稳定边界

- 每轮请求使用唯一 `requestId`，只向同名 Tauri event channel 发出事件；
- 前端消费 `started`、`state`、`delta`、`message`、`activity`、`proposal`、`approval`、`usage`、`metric`、`done`、`error` 与 `cancelled`；每个事件携带全局单调 `sequence` 与时间戳，迟到事件由 reducer 拒绝；
- Provider SSE 在 native 逐块解码，`TextDelta`、`ReasoningSummary` 与 `ToolInputStarted` 先归一化再跨 IPC，不能等待完整 response 后伪造流式输出；其中 Provider 原始 reasoning summary 不直接持久化或展示，必须先去除 Markdown、限制长度，并把非中文摘要替换为稳定中文进度说明；
- Provider 原始响应只在原生适配器内存在，进入 renderer 前必须归一化；
- Runtime 是 `runPhase` 与 item lifecycle 的唯一所有者。`activityKind/activityState/visibility/activeItemId/parentId` 由 native 明确发出，renderer 不得根据中文标题、数组尾项或计时器猜测当前动作；
- 折叠摘要只投影 `runPhase + activeItemId`；展开轨迹只显示 `detail/milestone`，Provider 请求、模型记账、MCP discovery 等 `diagnostic` 事件不计入步骤；reasoning 使用单一稳定 item 并在文本、工具或终态到来前显式完成；
- 取消信号贯穿网络请求、tool loop、MCP call 和审批等待；终态后迟到事件不得改写结果；
- usage 与 timing 可以持久化，但 prompt、正文、附件内容、token 与 API key 不进入日志和指标；
- 对话、审阅和 action payload 是 Loby 契约，不随 Provider 改变。

## Provider 模型

Provider 是模型传输适配器，不是 Agent Runtime。

```text
ModelProvider
  listModels()
  startTurn(request)
  continueWithToolResults(results)
  cancel()
```

首批 Provider：

- `openai-api`：用户 API key，调用公开 Responses API；
- `anthropic-api`：用户 API key，调用 Messages API；
- `openai-compatible`：用户提供 base URL、model 与 API key；
- `chatgpt-subscription`：用户通过 ChatGPT Device OAuth 登录，调用 ChatGPT Codex entitlement 对应的 Responses endpoint，消耗账号订阅内 Codex 用量；不需要 Codex CLI、SDK 或 app-server。

模型目录由 Provider 自己给出稳定默认值或远端发现结果。用户选择归 Loby 设置所有，Provider 不得用外部客户端的全局配置静默覆盖。

ChatGPT 与 Claude 的“订阅登录”必须和 API Provider 分开。ChatGPT 登录拿到的 OAuth token 不调用 `api.openai.com/v1/responses`，而是携带 `ChatGPT-Account-Id` 调用 `chatgpt.com/backend-api/codex/responses`；OpenAI 官方工程文章公开说明了这两个 endpoint 的区别。Loby 自己实现 OAuth、token refresh 和 Responses transport，Agent Loop、工具、Skill、MCP、会话与审阅仍完全归 Loby，不引入 Codex runtime。Claude Pro/Max 仍不等于 Anthropic API 额度；在 Anthropic 提供可验证的账号授权边界前只支持 API key。

ChatGPT subscription transport 作为独立且可替换的实验性适配器维护：强制 `store=false`、`stream=true`、顶层 `instructions`，只开放订阅 endpoint 实际支持的模型，并为协议变化保留明确错误。不得读取 Codex、浏览器或其他应用的 cookie、token 和本地配置。实现证据以 [OpenAI Agent Loop 说明](https://openai.com/index/unrolling-the-codex-agent-loop/) 和 [OpenAI Codex 开源实现](https://github.com/openai/codex) 为基线；第三方兼容性不等于 Platform API SLA。

## Agent Loop

单轮运行遵循有限状态机：

```text
prepare context
  -> waitingForModel -> reasoning / streamingAnswer
  -> tool calls: queued -> approve if needed -> running -> completed|failed|cancelled
  -> proposal calls: validate -> emit proposal -> wait for author in renderer
  -> request model again
  -> finalizing -> completed / cancelled / failed
```

实时状态和历史记录都保存同一 `AgentRunInfo` v2 快照。应用重开时若发现仍为 `running` 的消息快照，恢复层必须将其收口为明确的 interrupted error，不能继续显示虚假的运行中状态；native 同时读取 `.loby/ai/runs` 最小恢复日志，为原任务提供显式重试/放弃卡片，但不自动重放写工具。

硬限制：

- 单轮 tool loop 有最大步数、总时长和单工具超时；
- 同一轮最多执行 8 次模型/工具循环，工具结果最大 64 KB；
- 外部写入、发布、命令和敏感路径访问必须审批；
- 工具结果经过大小限制和敏感字段过滤后才能回传模型；
- `propose_*` 调用只产生结构化建议，不等于写入；旧 `loby-change` / `loby-action` 仅兼容历史会话。

## 本地 Markdown 与上下文

对话历史分为完整本地事实与有界 Provider model view。`.loby/ai/conversations.json` 保存全部消息；Conversation Context Planner 根据模型窗口和输出预留动态选择最近完整 turn，较早历史只在模型视图中压缩为结构化 checkpoint，不再使用固定“最后 8 条”或把角色扁平化为一段字符串。

默认模型视图只包含完成任务所需内容：

- 当前项目、文稿、写作 brief 与实时正文；
- 用户明确挂载的文稿、选区、图片和项目资源；
- 必要的文稿结构、发布要求和 Loby 操作协议；
- 最近完整的 user/assistant turn；
- 较早对话的目标、约束、结论、待决动作、变更与产物 checkpoint。

界面在对话菜单中显示上次估算的 token 使用量与已压缩消息数。压缩不删除原始聊天，模型切换或写作上下文变化会重新规划视图。

本地文件工具只允许访问当前活动写作库。默认排除 `.loby/`、隐藏目录、临时文件、凭证文件和写作库外路径。读取前 canonicalize 并验证范围，返回文本设单文件和单轮总量上限。写入正文不通过通用文件工具，而由严格 `propose_*` 工具生成结构化建议，再进入编辑器既有确认与审阅。

## Tool Registry

所有工具通过统一描述进入 Agent Loop：

```text
ToolDefinition
  id / displayName / description / inputSchema
  source: builtin | skill | mcp
  effect: read | network | proposal | write | execute
  timeout / resultLimit / approvalPolicy
```

第一批内置能力：

- `read_markdown`、`list_documents`、`search_documents`；
- `web_search`；
- `generate_image` 与持久图片成果；
- `propose_insert_text`、`propose_create_sheet`、`propose_insert_image`、`propose_save_export`、`propose_document_change`；
- Skill 加载与执行；
- MCP tool 代理。

V1 不开放任意 shell。将来若增加，只能作为独立高风险工具，逐次展示完整命令、cwd 和影响范围并等待审批；Skill 与 MCP 都不能绕过该政策。

## Skill

Skill 是用户可读、可编辑、可重复调用的本地工作流包。落笔采用开放 Agent Skills 标准，只发现应用随附 `skills/` 与当前写作库 `<library>/.agents/skills/`；不会自动读取 Codex、Claude Code 或其他应用的全局目录。

运行时通过 name/description catalog 发现相关能力，再用 `activate_skill` 渐进读取完整 `SKILL.md`，并通过 `read_skill_resource` 按需读取 references/assets。Skill 只贡献工作流，不获得额外文件、网络、命令或 MCP 权限；V1 保留但不执行 scripts。

内置 `skill-creator` 支持从对话创建，以及通过 `inspect_skill_package`、`update_skill` 适配显式导入的外部 Skill。确定性校验、复制、原子写入、启停与删除归 native Skill Store，完整契约见 [`agent-skills.md`](agent-skills.md) 与 [ADR 0007](adr/0007-open-agent-skills.md)。

## MCP

Loby 是 MCP client。V1 支持 `stdio` 与 `Streamable HTTP`：

- server 配置、启停和连接状态；
- tools/list 发现、JSON Schema 映射与 tools/call；
- server/tool 级权限、超时、取消和结果大小限制；
- HTTP Bearer token 存入原生安全存储；正式 OAuth 在 server 与供应商契约明确后另行接入；
- stdio command 使用精确 executable、args、env allowlist 和 cwd，不能经 shell 拼接；
- server 返回值序列化为有大小上限的工具结果；V1 的所有 MCP 调用在执行前进入统一审批，server 自报的 `readOnlyHint` 只用于展示，不能作为免审批授权。

MCP server 不得自动安装、自动授权或继承其他应用配置。Loby V1 不作为 MCP server 对外暴露能力。

## 联网搜索与图片

联网搜索和图片生成都是 Provider-neutral 工具。模型可以建议调用，但用户设置决定实际服务：

- Tavily 搜索适配器返回标题、URL 与摘要，并只接受有长度上限的查询；
- 图片不是由 GPT 文本模型直接编码输出；`generate_image` 统一调用专用 `gpt-image-2` 服务。ChatGPT 订阅适配器携带 Loby Device OAuth 的 bearer 与 `ChatGPT-Account-ID` 调用 `/backend-api/codex/images/generations|edits`，OpenAI API 适配器调用 `/v1/images/generations|edits`；
- 自动路由优先复用当前可用的对话 Provider，再选择已配置的 ChatGPT 订阅或 OpenAI API；用户明确指定服务后，失败不得静默切换到另一计费通道；
- 图片适配器只返回本地临时成果与建议路径；用户接受 `propose_insert_image` 后才复制到写作库 `assets/images` 并生成当前 Markdown 格式的稳定相对引用；
- 搜索 key 使用独立 credential owner；OpenAI 图片服务复用 `openai-api` credential owner，ChatGPT 图片服务复用 Loby 自己的订阅 OAuth bundle，任何 MCP server 不可见这些凭证。

## 对话、审阅与动作

对话、消息、上下文预览、AI 修改结果和动作卡片保存在写作库 `.loby/ai/conversations.json`；聊天记录不是正文事实来源。

- `propose_document_change` 用于整篇或大段候选正文，以发送时 `baseBody` 与最终 `proposedBody` 生成可审阅 diff；
- 其余 `propose_*` 工具用于 `createSheet`、`insertText`、`insertImage` 与 `saveExport`，payload 直接转换为现有 `AiAction`；
- `loby-change` / `loby-action` 解析器只读取旧历史，不再作为新模型输出协议；
- 应用前创建 AI 来源快照；拒绝、接受、撤销和失败都保留明确状态；
- 工具执行完成不代表正文已修改，模型和界面不得混淆这两个事实。
- 编辑旧 user message 创建带 `parentConversationId` / `forkedFromMessageId` 的新会话分支，原历史不截断；
- composer 附件发送前由 native 提升到 `.loby/ai/attachments/<SHA-256>/`，会话保留稳定附件记录，历史重载后可以再次预览和提供给 Provider；
- 每个 native run 在 `.loby/ai/runs` 留下最小 checkpoint，正常终态删除；崩溃残留只能经用户确认作为新一轮重试，进入过写工具的任务必须先检查外部状态。

## 分阶段完成定义

1. **Runtime core**：Provider registry、credential boundary、request/event、取消与基础模型调用；
2. **Local collaboration**：上下文、Markdown 只读工具、Skill 与现有审阅协议；
3. **Connected tools**：联网搜索、图片生成、MCP 与权限审批；
4. **Account providers**：ChatGPT Device OAuth、刷新、退出与失效恢复已经接入；Claude 等账号 Provider 等待可验证授权边界；
5. **Removal**：仓库不再包含 Codex CLI/app-server、探测设置、`.codex` 路径 scope 或兼容测试；
6. **Regression**：普通问答、长文、附件、取消、工具失败、图片成果、正文审阅、恢复与敏感信息检查全部通过。

每个阶段都必须保持 Markdown 本地事实、作者审阅和对话可恢复，不以临时 stub 冒充已完成能力。

类型化 stream 与提案工具见 [ADR 0008](adr/0008-typed-agent-events-and-proposals.md)；多轮上下文、压缩、附件、分支和恢复见 [ADR 0009](adr/0009-durable-conversation-context.md)。
