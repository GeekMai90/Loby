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
  -> request-scoped stream events
  -> conversation / review / action cards
```

运行时拥有任务的编排和停止条件，但不重新实现标准协议。HTTP、系统安全存储和 MCP transport 使用受控第三方库；未来账号 Provider 只有在供应商提供正式授权契约时才引入 OAuth PKCE。第三方库不能拥有 Loby 的对话历史、写作上下文、修改审阅或权限政策。

### 稳定边界

- 每轮请求使用唯一 `requestId`，只向同名 Tauri event channel 发出事件；
- 前端继续消费 `started`、`delta`、`message`、`activity`、`approval`、`usage`、`metric`、`done`、`error` 与 `cancelled`；
- Provider 原始响应只在原生适配器内存在，进入 renderer 前必须归一化；
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
- `chatgpt-subscription`：预留的账号 Provider；只有 OpenAI 为独立第三方 runtime 提供正式授权范围和受支持的订阅调用 API 后才启用。

模型目录由 Provider 自己给出稳定默认值或远端发现结果。用户选择归 Loby 设置所有，Provider 不得用外部客户端的全局配置静默覆盖。

ChatGPT 与 Claude 的“订阅登录”必须和 API Provider 分开。ChatGPT 订阅当前包含 Codex 产品用量，官方 Codex SDK 也提供 ChatGPT 登录，但该 SDK 会安装并驱动匹配的 Codex CLI runtime；OAuth token 不能直接用于公开 Responses API。由于本次架构明确移除 Codex runtime，这条通道不能冒充 Loby 原生 Provider。Claude Pro/Max 同样不等于 Anthropic API 额度。界面因此只展示未开放状态；不得读取其他应用的 cookie、token、本地配置或调用未公开后端绕过边界。

## Agent Loop

单轮运行遵循有限状态机：

```text
prepare context
  -> request model
  -> assistant text: publish and finish
  -> tool calls: validate -> approve if needed -> execute -> append results
  -> request model again
  -> finish / cancel / fail
```

硬限制：

- 单轮 tool loop 有最大步数、总时长和单工具超时；
- 同一轮最多执行 8 次模型/工具循环，工具结果最大 64 KB；
- 外部写入、发布、命令和敏感路径访问必须审批；
- 工具结果经过大小限制和敏感字段过滤后才能回传模型；
- 模型返回的 `loby-change` / `loby-action` 仍只是可审阅建议，不等于工具执行权限。

## 本地 Markdown 与上下文

默认上下文只包含完成任务所需内容：

- 当前项目、文稿、写作 brief 与实时正文；
- 用户明确挂载的文稿、选区、图片和项目资源；
- 必要的文稿结构、发布要求和 Loby 操作协议；
- 最近有限条对话。

本地文件工具只允许访问当前活动写作库。默认排除 `.loby/`、隐藏目录、临时文件、凭证文件和写作库外路径。读取前 canonicalize 并验证范围，返回文本设单文件和单轮总量上限。写入正文不通过通用文件工具，而继续使用 `loby-change`、`loby-action` 与编辑器审阅。

## Tool Registry

所有工具通过统一描述进入 Agent Loop：

```text
ToolDefinition
  id / displayName / description / inputSchema
  source: builtin | skill | mcp
  effect: read | network | write | execute
  timeout / resultLimit / approvalPolicy
```

第一批内置能力：

- `read_markdown`、`list_documents`、`search_documents`；
- `web_search`；
- `generate_image` 与持久图片成果；
- Skill 加载与执行；
- MCP tool 代理。

V1 不开放任意 shell。将来若增加，只能作为独立高风险工具，逐次展示完整命令、cwd 和影响范围并等待审批；Skill 与 MCP 都不能绕过该政策。

## Skill

Skill 是用户可读、可编辑、可重复调用的本地工作流包。Loby 发现以下受控来源：

- 应用随附 `skills/`；
- 用户配置的个人 Skill 目录；
- 当前写作库内显式启用的 Skill 目录。

`SKILL.md` 提供名称、描述和执行说明。V1 读取该文件的稳定 frontmatter 与受限正文；Skill 只向 Agent Loop 贡献工作流说明，不获得额外文件、网络、命令或 MCP 权限。脚本、模板和资源仍必须通过已注册工具显式接入。

## MCP

Loby 是 MCP client。V1 支持 `stdio` 与 `Streamable HTTP`：

- server 配置、启停和连接状态；
- tools/list 发现、JSON Schema 映射与 tools/call；
- server/tool 级权限、超时、取消和结果大小限制；
- HTTP Bearer token 存入原生安全存储；正式 OAuth 在 server 与供应商契约明确后另行接入；
- stdio command 使用精确 executable、args、env allowlist 和 cwd，不能经 shell 拼接；
- server 返回值序列化为有大小上限的工具结果；写入型工具在执行前进入统一审批。

MCP server 不得自动安装、自动授权或继承其他应用配置。Loby V1 不作为 MCP server 对外暴露能力。

## 联网搜索与图片

联网搜索和图片生成都是 Provider-neutral 工具。模型可以建议调用，但用户设置决定实际服务：

- Tavily 搜索适配器返回标题、URL 与摘要，并只接受有长度上限的查询；
- 图片适配器返回本地临时成果与元数据，进入正文前复制到写作库受控 assets 并通过 `insertImage` 确认；
- 搜索 key 使用独立 credential owner；图片生成显式复用用户配置的 OpenAI API key，任何 MCP server 不可见这些凭证。

## 对话、审阅与动作

对话、消息、上下文预览、AI 修改结果和动作卡片保存在写作库 `.loby/ai/conversations.json`；聊天记录不是正文事实来源。

- `loby-change` 用于整篇或大段候选正文，以发送时 `baseBody` 与最终 `proposedBody` 生成可审阅 diff；
- `loby-action` 用于 `createSheet`、`insertText`、`insertImage` 与 `saveExport`；
- 应用前创建 AI 来源快照；拒绝、接受、撤销和失败都保留明确状态；
- 工具执行完成不代表正文已修改，模型和界面不得混淆这两个事实。

## 分阶段完成定义

1. **Runtime core**：Provider registry、credential boundary、request/event、取消与基础模型调用；
2. **Local collaboration**：上下文、Markdown 只读工具、Skill 与现有审阅协议；
3. **Connected tools**：联网搜索、图片生成、MCP 与权限审批；
4. **Account providers**：等待供应商为独立第三方 runtime 提供正式订阅授权后，再实现可验证的登录、刷新、退出与失效恢复；
5. **Removal**：仓库不再包含 Codex CLI/app-server、探测设置、`.codex` 路径 scope 或兼容测试；
6. **Regression**：普通问答、长文、附件、取消、工具失败、图片成果、正文审阅、恢复与敏感信息检查全部通过。

每个阶段都必须保持 Markdown 本地事实、作者审阅和对话可恢复，不以临时 stub 冒充已完成能力。
