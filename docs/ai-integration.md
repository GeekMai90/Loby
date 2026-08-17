# AI 集成

## 产品角色

Loby 的 AI 是作者的写作协作伙伴，而不是作者的替代者。它可以回答问题、分析结构、局部润色、查找资料、提出修改和准备发布内容；用户明确要求时也可以提供可审阅的完整初稿，但作者始终决定最终表达以及是否把结果写进正文。Markdown 与写作目录仍是内容的唯一事实来源。

固定系统提示只承载稳定身份、写作质量、事实诚实、作者控制与工具高层边界；`propose_*` 参数、文件和图片路径、Skill 安装步骤、当前项目与稿件事实属于工具 schema 或每轮动态上下文。两层不得复制同一执行细节，避免规则漂移。

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
- 折叠摘要只投影 `runPhase + activeItemId`；`waitingForModel` 使用 15 条文案组成的七秒随机洗牌袋，一轮内不重复且跨轮不连续重复，但不能伪造 reasoning 或工具步骤，真实事件到达后立即恢复精确状态。展开轨迹只显示 `detail/milestone`，Provider 请求、模型记账、MCP discovery 等 `diagnostic` 事件不计入步骤；reasoning 使用单一稳定 item 并在文本、工具或终态到来前显式完成；
- native 事件 kind 使用封闭枚举；renderer 保留 typed item id、按首次出现顺序原位更新活动并拒绝非 reasoning 生命周期回退。run 一旦进入 completed/failed/cancelled，任何更大 sequence 的迟到 IPC 也不能重新打开状态或追加正文；
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
- `qwen-api`：用户千问 API key，调用阿里云百炼 OpenAI Chat Completions 兼容接口；
- `minimax-api`：用户 MiniMax API key，调用官方推荐的 Anthropic-compatible Messages 接口，让 thinking block 与最终 text 保持结构化分离；
- `deepseek-api`：用户 DeepSeek API key，调用 DeepSeek OpenAI Chat Completions 兼容接口；
- `kimi-api`：用户 Kimi API key，调用月之暗面 OpenAI Chat Completions 兼容接口；
- `openai-compatible`：用户提供 base URL、model 与 API key；
- `chatgpt-subscription`：用户通过可取消的 ChatGPT Device OAuth 登录，调用 ChatGPT Codex entitlement 对应的 Responses endpoint，消耗账号订阅内 Codex 用量；不需要 Codex CLI、SDK 或 app-server，renderer 不接收邮箱、token 或 account ID。

模型目录由 Provider 自己给出稳定默认值或远端发现结果。设置页持久化应用级 Provider、模型和推理默认值；新对话从这里初始化自己的选择，composer 中的切换只写当前对话并由分支继承，不得反向覆盖设置。模型目录加载只是提供可选项和能力信息，空目录、部分目录或回退目录不得静默替换已持久化的默认值或当前对话选择；只有用户显式选择模型时才按目录收敛推理档位。Provider 也不得用外部客户端的全局配置静默覆盖。

Provider transport 共享原生 HTTP 连接池，并把连接、响应起始和 stream 空闲分别设限。只有在尚未产生成功响应和可见 stream 时，连接失败或明确的 `408/429/500/502/503/504` 才可额外重试至多两次；超过 15 秒的 `Retry-After` 不自动等待。成功 stream 一旦开始便不得自动重放，避免重复文字、重复工具调用或重复计费。认证、限流、过载、上下文超限、模型不可用、网络、超时与协议错误在 native 边界归一化为可操作文案，Provider 原始响应细节不得越过长度与敏感信息边界。完整决策见 [ADR 0010](adr/0010-provider-transport-resilience.md)。

模型能力属于目录契约，不由 UI 或模型名称猜测。adapter 只有在模型明确支持时才发送推理扩展字段，renderer 也只显示已声明的档位：千问档位映射到 `thinking_budget`，DeepSeek 使用厂商声明的 `high/max`，Kimi 使用启停控制；MiniMax 使用 Anthropic-compatible 的原生 thinking block，但当前不伪造不存在的强度选项。OpenAI-compatible 默认只承诺基础 Responses 兼容，不推断推理扩展；Loby 不做跨 Provider 自动 fallback，也不在用户不知情时切换账号或计费通道。

ChatGPT 的“订阅登录”必须和 API Provider 分开。ChatGPT 登录拿到的 OAuth token 不调用 `api.openai.com/v1/responses`，而是携带 `ChatGPT-Account-Id` 调用 `chatgpt.com/backend-api/codex/responses`；OpenAI 官方工程文章公开说明了这两个 endpoint 的区别。Loby 自己实现 ChatGPT OAuth、token refresh 和 Responses transport，Agent Loop、工具、Skill、MCP、会话与审阅仍完全归 Loby，不引入 Codex runtime。Claude Pro/Max 不等于 Anthropic API 额度；当前产品不提供 Claude 订阅连接，只支持 Anthropic API Provider。

ChatGPT subscription transport 作为独立且可替换的实验性适配器维护：强制 `store=false`、`stream=true`、顶层 `instructions`；登录后使用同一 OAuth/account context 实时读取 `/backend-api/codex/models?client_version=...`，只把账号返回且 `visibility=list` 的模型、上下文、思考档位与服务层投影给 renderer，读取失败时回退到随版本维护的安全目录。凭证变化必须触发目录刷新，不能把登录前的静态目录保留到连接完成之后。不得读取 Codex、浏览器或其他应用的 cookie、token 和本地配置。实现证据以 [OpenAI Agent Loop 说明](https://openai.com/index/unrolling-the-codex-agent-loop/) 和 [OpenAI Codex 开源实现](https://github.com/openai/codex) 为基线；第三方兼容性不等于 Platform API SLA。

## Agent Loop

单轮运行遵循有限状态机：

```text
prepare context
  -> waitingForModel -> reasoning / streamingAnswer
  -> tool calls: queued -> approve if needed -> running -> completed|failed|cancelled
  -> proposal calls: validate -> emit pending author card -> return receipt to model
  -> request model again
  -> finalizing -> completed / cancelled / failed
```

实时状态和历史记录都保存同一 `AgentRunInfo` v2 快照。应用重开时若发现仍为 `running` 的消息快照，恢复层必须将其收口为明确的 interrupted error，不能继续显示虚假的运行中状态；native 同时读取 `.loby/ai/runs` 最小恢复日志，为原任务提供显式重试/放弃卡片，但不自动重放写工具。

硬限制：

- 单轮 tool loop 有最大步数、总时长和单工具超时；
- 普通模式同一轮最多执行 12 次、`autonomous-read` 只读模式最多执行 24 次已完成的模型/工具循环；运行中补充要求只中止当前网络 attempt，不消耗业务步数；
- 提案调用只记录待确认动作，不代表作者已经执行；单个提案不得提前结束整轮，多图片等复合任务必须让模型继续循环并逐项补齐确认卡片；
- 整轮最多运行 20 分钟、单工具最多运行 6 分钟；取消和总时限覆盖 MCP discovery、Provider、审批等待与工具执行；
- 同一个 `requestId` 同时只能注册一个运行控制句柄，重复启动必须拒绝，不能覆盖成不可取消的孤儿任务；
- 工具结果最大 64 KB；已获批写工具在获得确定结果前属于不确定外部写入，取消或超时必须保留恢复 checkpoint 并要求先检查目标状态；
- 外部写入、发布、命令和敏感路径访问必须审批；
- 工具结果经过大小限制和敏感字段过滤后才能回传模型；
- `propose_*` 调用只产生结构化建议，不等于写入；旧 `loby-change` / `loby-action` 仅兼容历史会话。

## 本地 Markdown 与上下文

对话历史分为完整本地事实与有界 Provider model view。`.loby/ai/conversations.json` 保存全部消息；Conversation Context Planner 根据模型窗口和输出预留动态选择最近完整 turn，较早历史只在模型视图中压缩为结构化 checkpoint，不再使用固定“最后 8 条”或把角色扁平化为一段字符串。checkpoint 同时记录消息边界和模型可见语义指纹：动作从 proposed 变为 applied、变更状态更新或产物关联变化时，即使消息 ID 未变也必须重建，不能复用过期摘要。

默认模型视图只包含完成任务所需内容：

- 当前项目、文稿、写作 brief 与实时正文；
- 用户明确挂载的文稿、选区、图片和项目资源；
- 必要的文稿结构、发布要求和 Loby 操作协议；
- 最近完整的 user/assistant turn；
- 较早对话的目标、约束、结论、待决动作、变更与产物 checkpoint。

动作与变更投影只提取 Loby 已知的写作字段，包括目标、文本、正文、图片路径、标题和文件名，并受独立 token 上限约束；不把任意 payload 整包注入模型。待决 action 必须保留实际待插入内容，change set 必须保留有界的 `proposedBody`，不能只告诉模型“存在一项建议”。完整复用规则见 [ADR 0012](adr/0012-semantic-conversation-checkpoints.md)。

界面在对话菜单中显示上次估算的 token 使用量与已压缩消息数。压缩不删除原始聊天，模型切换或写作上下文变化会重新规划视图。

本地 Markdown 文件工具只允许访问当前活动写作库。用户在当前对话中明确提供外部参考目录时，`read_local_directory` 可以在该目录的只读范围内列出并读取受支持的文本样式文件；它支持用 `files` 一次读取最多 8 个相关文件，避免模型逐文件消耗循环预算。工具默认排除 `.loby/`、隐藏目录、临时文件、凭证文件、构建依赖、符号链接和路径逃逸，并限制文件数量、单文件大小与单轮扫描总量。读取前 canonicalize 并验证范围，敏感文件和常见配置密钥行会在工具边界隐藏，结果再经过大小限制后回传模型。写入正文不通过通用文件工具，而由严格 `propose_*` 工具生成结构化建议，再进入编辑器既有确认与审阅。

### Loby Markdown 行内格式契约

AI 修改正文时必须使用编辑器能够即时识别的 Markdown 格式，不要把发布 HTML 当作正文格式写回文稿：

- 粗体使用 `**文字**`，斜体使用 `*文字*`，下划线使用 `~文字~`，删除线使用 `~~文字~~`。
- 高亮必须使用 `==重点文字==`；`<mark>重点文字</mark>` 只属于导出/预览 HTML，不是 Loby 正文协议。
- 行内代码使用反引号，链接使用标准 Markdown 链接；标题、引用、列表和任务使用标准 Markdown。
- 行内格式标记必须成对并尽量保持在同一行。若格式结束后紧接中文正文，关闭标记后保留一个空格，例如 `**“注意力 > 时间 > 金钱”** 这个价值观`，避免 `**“注意力 > 时间 > 金钱”**这个价值观` 触发标准 Markdown 的分隔符歧义；Loby 的 HTML/公众号渲染器同时兼容已有的无空格中文写法，不要求先改写源 Markdown。

## Tool Registry

所有工具通过统一描述进入 Agent Loop：

```text
ToolDefinition
  name / description / inputSchema
  effect: read | network | proposal | write
```

`effect` 是 native 封闭枚举而不是任意字符串：新增工具若没有选择合法副作用类型便无法编译，未知值不能静默绕过审批。Skill 只指导模型组合这些工具，不直接注册可执行代码；MCP 工具通过 `mcp__server__tool` 命名空间进入同一 registry，并保守映射为 `write`。单工具时限、敏感字段脱敏和 64 KB 结果上限由统一执行子状态机强制，不信任 Provider 或 MCP server 自报；JSON 结果递归清除 token、authorization、password、secret、cookie 与 credential 字段，普通文本对常见赋值行执行同样处理。

第一批内置能力：

- `read_markdown`、`list_documents`、`search_documents`；
- `web_search`；
- `generate_image` 与持久图片成果；
- `propose_insert_text`、`propose_create_sheet`、`propose_insert_image`、`propose_save_export`、`propose_document_change`；
- Skill 加载与执行；
- MCP tool 代理。

V1 不开放任意 shell。将来若增加，只能作为独立高风险工具，逐次展示完整命令、cwd 和影响范围并等待审批；Skill 与 MCP 都不能绕过该政策。

本地 Markdown 工具逐参数复验，不以传给模型的 JSON Schema 代替执行边界校验。单文件最多读取 512 KB，全文搜索每次最多扫描 32 MB，并返回 `scanTruncated`；达到预算后模型应缩小关键词继续搜索。工具 schema 只能声明执行器真实消费的字段，不能接受后静默忽略。详见 [ADR 0013](adr/0013-closed-tool-effects.md)。

## Skill

Skill 是用户可读、可编辑、可重复调用的本地工作流包。落笔采用开放 Agent Skills 标准，只发现应用随附 `skills/` 与当前写作库 `<library>/.agents/skills/`；不会自动读取 Codex、Claude Code 或其他应用的全局目录。

运行时通过 name/description catalog 发现相关能力，再用 `activate_skill` 渐进读取完整 `SKILL.md`，并通过 `read_skill_resource` 按 UTF-8 边界分页读取 references。只有具备显式 name/description/正文且不超过 48 KB/500 行的 `SKILL.md` 才能直接激活；文件目录和单次资源结果均有独立预算，二进制 assets 不向模型暴露绝对路径。Skill 只贡献工作流，不获得额外文件、网络、命令或 MCP 权限；V1 保留但不执行 scripts。

内置 `skill-creator` 支持从对话创建，以及通过 `inspect_skill_package`、`update_skill` 适配显式导入的外部 Skill。确定性校验、复制、原子写入、启停与删除归 native Skill Store，完整契约见 [`agent-skills.md`](agent-skills.md) 与 [ADR 0007](adr/0007-open-agent-skills.md)。

## MCP

Loby 是 MCP client。V1 支持 `stdio` 与 `Streamable HTTP`：

- server 配置、启停和连接状态；
- tools/list 发现、JSON Schema 映射与 tools/call；
- server/tool 级权限、超时、取消和结果大小限制；
- HTTP Bearer token 存入原生安全存储；正式 OAuth 在 server 与供应商契约明确后另行接入；
- stdio command 使用精确 executable、args、env allowlist 和 cwd，不能经 shell 拼接；
- server 返回值序列化为有大小上限的工具结果；V1 的所有 MCP 调用在执行前进入统一审批，server 自报的 `readOnlyHint` 只用于展示，不能作为免审批授权。

已启用 server 的 `tools/list` 并发执行，结果按执行配置指纹缓存 5 分钟并恢复稳定 server 顺序；每 server 最多暴露 64 个工具、每轮总计 128 个、单 schema 64 KB、描述 2,000 字符。MCP 原始名称、作者可见名称和 Provider 可调用别名分离；非标准但安全的 server 名称会生成带 hash 的有界别名，不会因不同 Provider 的 function-name 限制丢失身份。审批后调用前重新校验配置指纹，HTTP transport 禁止重定向。

Loby 当前缓存工具目录而非长期持有外部进程：发现和调用各自建立可取消的短会话。这是写作应用的刻意取舍，避免少量可选 MCP 把桌面应用变成常驻进程管理器；代价是首次真实调用仍需重新握手。完整决策见 [ADR 0016](adr/0016-bounded-skill-and-mcp-adapters.md)。

MCP server 不得自动安装、自动授权或继承其他应用配置。Loby V1 不作为 MCP server 对外暴露能力。

## 联网搜索与图片

联网搜索和图片生成都是 Provider-neutral 工具。模型只看到稳定的 `web_search` / `generate_image` 契约，native runtime 根据当前对话连接决定实际服务：

- OpenAI API、ChatGPT 订阅、Anthropic API 与千问连接优先复用各自已有凭证的 Provider-native 搜索；原生搜索失败时自动改用 DuckDuckGo；
- MiniMax、DeepSeek、Kimi 和自定义连接当前直接使用无 Key 的 DuckDuckGo HTML/Lite 双端点兜底。搜索结果统一归一化为标题、URL、摘要与可选的 Provider 综述，查询和结果数量均有上限；
- 联网搜索不再使用 Tavily，也不维护独立搜索 API Key；凭证存储升级会删除旧版 `tavily-search` 记录；
- 图片不是由 GPT 文本模型直接编码输出；`generate_image` 统一调用专用 `gpt-image-2` 服务。ChatGPT 订阅适配器携带 Loby Device OAuth 的 bearer 与 `ChatGPT-Account-ID` 调用 `/backend-api/codex/images/generations|edits`，OpenAI API 适配器调用 `/v1/images/generations|edits`；
- 自动路由优先复用当前可用的对话 Provider，再选择已配置的 ChatGPT 订阅或 OpenAI API；用户明确指定服务后，失败不得静默切换到另一计费通道；
- 图片适配器只返回本地临时成果与建议路径；用户接受 `propose_insert_image` 后才复制到写作库 `assets/images` 并生成当前 Markdown 格式的稳定相对引用；
- 搜索与图片都只复用“连接”中已添加的 Provider credential 或 ChatGPT 订阅 OAuth bundle，任何 MCP server 不可见这些凭证。

## 对话、审阅与动作

对话、消息、上下文预览、AI 修改结果和动作卡片保存在写作库 `.loby/ai/conversations.json`；聊天记录不是正文事实来源。持久化只接受最多 64 MB 的 JSON 数组，改写前保留上一份通过解析的 `.loby/ai/conversations.backup.json`，主文件解析失败时回退到备份，不用空历史覆盖损坏证据。

微信公众号主题助手复用同一 Agent Runtime、Provider 连接目录、Composer 输入、通用图片/文档附件、会话上下文规划与请求级事件协议，但其主题会话仍由 publishing feature 按主题作用域保存。主题 Skill 和 `loby-wechat-theme-result` 是领域适配器；它们不进入主助手的正文 proposal/action 状态机，也不依赖 Provider 的隐式 thread。

- `propose_document_change` 用于整篇或大段候选正文，以发送时 `baseBody` 与最终 `proposedBody` 生成可审阅 diff；点击“显示更改”查看修改后正文与差异，点击“隐藏更改”切换到只读的 `baseBody` 修改前预览，预览不会写回本地 Markdown；
- 其余 `propose_*` 工具用于 `createSheet`、`insertText`、`insertImage` 与 `saveExport`；插入工具以可选的简单 `anchor` object 表达段落、标题或唯一文本位置，非 anchor 目标省略该字段。Chat Completions 与 Anthropic-compatible Provider 接收适合宽松工具调用的精简 schema；OpenAI/ChatGPT Responses 在传输边界获得全字段 required、可空且 `additionalProperties: false` 的 strict schema。JSON Schema 只是模型提示，原生层只对已知提案字段受控解码一次字符串化 JSON，随后仍对顶层字段、枚举、嵌套 anchor 与文本大小执行封闭校验，再转换为现有 `AiAction`；
- 同一运行中，某张图片一旦通过 `anchor` 表达精确插入意图，即使参数校验失败也不得静默退回 `end`；模型必须修正锚点，无法定位时返回用户决策，不生成错误位置的确认卡片；
- 结构化 proposal 是动作参数和实时状态的唯一事实源；模型最终回复只说明已创建确认卡片、建议位置与必要理由。Runtime 回执明确禁止回显协议字段，renderer 在持久化前移除仍被 Provider 输出的“文稿动作”及 pending/target/path/anchor 等重复信息；
- `loby-change` / `loby-action` 解析器只读取旧历史，不再作为新模型输出协议；
- 应用前创建 AI 来源快照；拒绝、接受、撤销和失败都保留明确状态；
- 生成图片接受后先复制进写作库并把 action 的缓存来源提升为稳定相对路径，再尝试编辑器插入；即使正文写入失败，重试也不得重复导入同一临时成果；
- 同一消息、同一目标文稿中的多个待确认图片 action 在 renderer 边界合并为一个 `insertImages` 批量动作：按序展示每张图片及对应插入位置，随后只显示一张确认卡；确认后先验证全部资源和锚点，再通过一次 CodeMirror transaction、一个版本快照与一个 effect 原子写入，只提供一次撤销，任一项失败不得留下部分正文；已经执行的历史单图 action 保持独立，不做事后合并；
- 其他多项 action 在消息流按 action 身份逐项组合成果与确认卡/回执，不能把成果列表和决策列表分区渲染；
- 工具执行完成不代表正文已修改，模型和界面不得混淆这两个事实。
- 编辑旧 user message 创建带 `parentConversationId` / `forkedFromMessageId` 的新会话分支，原历史不截断；
- composer 附件发送前由 native 提升到 `.loby/ai/attachments/<SHA-256>/`，会话保留稳定附件记录，历史重载后可以再次预览和提供给 Provider；
- 每个 native run 在 `.loby/ai/runs` 留下最小 checkpoint，启动 command 只有在 checkpoint 已落盘后才返回成功，正常终态删除；崩溃残留只能经用户确认作为新一轮重试。接受恢复时先原子写入新 request 的 checkpoint，再删除旧记录并隐藏恢复卡；进入过写工具的任务必须先检查外部状态，不得自动重放。完整决策见 [ADR 0017](adr/0017-durable-recovery-handoff.md)。

## 分阶段完成定义

1. **Runtime core**：Provider registry、credential boundary、request/event、取消与基础模型调用；
2. **Local collaboration**：上下文、Markdown 只读工具、Skill 与现有审阅协议；
3. **Connected tools**：联网搜索、图片生成、MCP 与权限审批；
4. **Account providers**：ChatGPT Device OAuth、刷新、退出与失效恢复已经接入；
5. **Removal**：仓库不再包含 Codex CLI/app-server、探测设置、`.codex` 路径 scope 或兼容测试；
6. **Regression**：普通问答、长文、附件、取消、工具失败、图片成果、正文审阅、恢复与敏感信息检查全部通过。

每个阶段都必须保持 Markdown 本地事实、作者审阅和对话可恢复，不以临时 stub 冒充已完成能力。

类型化 stream 与提案工具见 [ADR 0008](adr/0008-typed-agent-events-and-proposals.md)；多轮上下文、压缩、附件、分支和恢复见 [ADR 0009](adr/0009-durable-conversation-context.md)。
