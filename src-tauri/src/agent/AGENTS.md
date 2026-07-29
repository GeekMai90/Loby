# agent/ - Loby-owned Agent Runtime

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

<member>
assistant_attachments.rs - composer 临时附件与写作库 `.loby/ai/attachments` 内容寻址存储，校验图片/文档并只向 Provider 暴露受管路径
chatgpt_auth.rs - ChatGPT Device OAuth、可取消轮询、token 刷新与无账号标识的订阅状态，向订阅 Provider 提供应用内访问上下文
chatgpt_models.rs - 使用当前 ChatGPT OAuth 账号实时读取 Codex `/models`，过滤账号可见模型并投影上下文、思考和快速服务层能力
connection_validation.rs - 使用各 Provider 模型目录执行无生成连接探测，验证服务可达性与当前凭证授权，不读取响应为业务模型目录
conversation_store.rs - 写作库内 AI 会话主 JSON、已验证备份、64 MB/数组校验与损坏回退，不拥有正文事实
credentials.rs - Provider、ChatGPT OAuth 与 MCP secret 的当前用户 app-config 文件边界，renderer 只能读取配置状态；存储升级时清理旧版 Tavily 凭证
discovery.rs - 按 Provider 隔离模型目录；ChatGPT 优先使用账号实时目录，未登录或短暂失败时回退本地安全目录
events.rs - Agent Event Protocol v2 构造器，统一 sequence、run phase、typed activity 生命周期、可见性、proposal、approval、usage 与 terminal
image_generation.rs - Provider-neutral 图片能力路由，使用 `gpt-image-2` 适配 ChatGPT 订阅 Codex Images 与 OpenAI Images API，并只产出临时成果
mcp.rs - MCP server 配置、官方 transport、并发有界工具发现缓存、Provider 安全别名、配置指纹绑定与受控调用
provider_conversation.rs - Provider-neutral 历史角色投影，校验 user/assistant 白名单并适配 Anthropic 相邻角色合并规则
provider_catalog.rs - 封闭 Provider id 与静态模型、上下文、推理档位目录，供发现与 runtime 复用但不拥有任何网络传输
provider_chat.rs - 千问、DeepSeek、Kimi 的固定 OpenAI Chat Completions Endpoint、推理参数、附件、工具续轮与响应状态适配
provider_http.rs - Provider HTTP 连接复用、响应启动/正文超时、尚未产生可见流时的安全重试、Retry-After 与类型化用户错误
provider_stream.rs - OpenAI Responses、Anthropic Messages 与 Chat Completions 的增量 SSE 解码、Qwen object/string 工具参数兼容、类型化事件发布和完整响应重建
providers.rs - 转发 Provider 目录，为 OpenAI/ChatGPT 生成严格全字段工具 schema，并适配 Responses、Anthropic/MiniMax Messages、Chat-compatible 与自定义 OpenAI-compatible 请求
provider_tests.rs - Provider 归一化、模型目录与响应解析的原生隔离回归测试，仅进入 test build
proposals.rs - 跨 Provider 的精简文稿提案 schema、无图片方言参数的可移植引用意图、受控字符串化对象归一化、运行内精确插入意图保护与作者控制边界
quick_prompt_store.rs - quick prompts 持久化
runtime.rs - 固定协作写作身份、有限 Agent Loop 与运行状态唯一所有者，拒绝重复 requestId，以独立 attempt/step 预算驱动 Provider 回合、steer/cancel、20 分钟总时限和 request 终态
runtime_tests.rs - Agent Loop 的 requestId 隔离、上下文分隔、steer 预算与重复启动回归，仅进入 test build
runtime_events.rs - Provider stream 到 Agent Event Protocol v2 的可观测性适配层，将模型摘要清理为有界中文纯文本、封口 reasoning 并按工具标识符确定 activity kind
runtime_tools.rs - 工具执行子状态机，独占 proposal 发布与禁止协议回显的非终止回执、审批等待、六分钟工具上限、不确定外部写入标记、工具 item 生命周期与结果敏感字段脱敏/截断
run_checkpoint.rs - 写作库内未完成运行日志与先写新记录再删旧记录的恢复替换，重启后只提供显式重试/放弃，禁止自动重放写工具
skill_format.rs - 开放 Agent Skills 必填 frontmatter/正文解析、名称规范化、48 KB/500 行渐进加载预算与 Loby 兼容性诊断
skill_import.rs - 设置选择或对话明确路径下目录、SKILL.md、ZIP/.skill 包的统一安全预检、解包与复制安装
skill_store.rs - 内置/写作库 Skill 发现、创建、更新、启停、删除、渐进激活、有界资源目录与 UTF-8 分页读取
tools.rs - 区分 Provider/display/execution identity 并以封闭 ToolEffect 标注 read/network/write/proposal 的注册表，负责本地 Markdown、Skill、Provider-neutral 搜索及图片生成的 schema、参数校验与分发
web_search.rs - 将统一 `web_search` 动态路由到 OpenAI、ChatGPT、Anthropic、千问原生搜索，其他连接或原生失败时使用无 Key 的 DuckDuckGo HTML/Lite 双端点兜底并归一化来源
</member>

该模块不拥有文稿持久化。Markdown 工具只能访问当前写作库内非隐藏的 `.md` 文件，拒绝符号链接和路径逃逸；Skill 只从 bundle 与当前写作库 `.agents/skills` 发现，外部导入只接受用户明确提供的单个路径并拒绝包内符号链接，scripts 不可执行，图片工具也只能上传已启用 Skill 包内通过格式与体积校验的参考图；composer 附件先进入进程临时目录，发送时按内容哈希提升到当前写作库受管目录，历史轮次只允许复用这两个根目录内的文件。联网搜索优先复用当前 OpenAI、ChatGPT、Anthropic 或千问连接的原生搜索，其他连接与原生搜索失败使用无 Key 的 DuckDuckGo，不维护独立搜索凭证。图片自动路由优先复用当前可生图的对话 Provider，再选择已配置的 ChatGPT 订阅或 OpenAI API；显式选择不静默跨计费服务回退。Provider、图片、ChatGPT OAuth 和 MCP 凭证只进入当前用户私有的 app-config 文件，启动不访问系统 Keychain。任意写入型 Skill/MCP tool 必须先经过 Loby 审批；正文修改由严格 `propose_*` 工具发出结构化建议，原生层只对已知提案字段受控解析一次字符串化 JSON，再对顶层与嵌套锚点执行封闭字段和语义校验。图片在同一运行中一旦表达精确 anchor 意图，后续不得静默降级为 `end`；无法修复定位时必须返回用户决策，不生成错误位置的确认卡片。通过校验的提案再进入 renderer 既有动作确认与 diff 审阅，runtime 不直接写正文。

工具副作用必须使用 `ToolEffect` 封闭枚举，未知 effect 不能降级为免审批工具；MCP read-only hint 当前仅作展示，所有 MCP 调用仍保守映射为 write 并逐次审批。工具 schema 不得声明执行器尚未消费的参数。写作库全文搜索单文件最多 512 KB、单次最多扫描 32 MB，并在结果中声明是否因预算截断；模型可缩小关键词继续搜索，不能让一次工具调用同步读取整个大型写作库。

Skill 只在 `name` / `description` / 工作流正文完整且 `SKILL.md` 不超过 48 KB/500 行时直接兼容；更长细节必须拆到 references。模型只获得 12 KB 有界资源目录，文本资源通过 offset 按页读取且单次序列化后不超过 48 KB；二进制资源不向模型暴露本机绝对路径。MCP 工具发现按 server 并发并缓存 5 分钟，每 server 最多 64 个、每轮总计最多 128 个，单 schema 最大 64 KB；原始 transport 名、面向作者的 display name 和符合 Provider 限制的 64 字符别名必须分离。发现时的运行配置指纹与调用绑定，HTTP 禁止重定向，防止审批后目标漂移。V1 只缓存工具目录，发现和调用仍使用可取消的短会话，不在桌面应用后台常驻任意 MCP 子进程。

Runtime 必须以封闭事件 kind 为每个 request 发出单调 sequence，并独占 `runPhase + activeItemId`；activity 必须携带稳定 kind/state/visibility，任何 queued/running/awaitingApproval item 都要收到 completed/failed/cancelled。Provider 记账与 MCP discovery 标为 diagnostic，reasoning 使用一个稳定聚合 item；Provider 原始 reasoning summary 是不可信展示输入，进入 renderer 前必须去除 Markdown、限制长度并对非中文内容使用本地化兜底。renderer 保留 typed item id、按首次出现顺序更新活动、拒绝非 reasoning 终态回退，并在 run 终态后拒绝任何迟到事件；禁止从 title 或事件尾项重建状态。

Runtime 固定系统提示只定义 Loby AI 的协作身份、事实与写作质量原则、作者控制边界、简洁进度摘要和 Skill 高层原则。具体 `propose_*` 字段、文件路径、图片规则、Skill 导入步骤与当前项目事实由工具 schema 和 renderer 动态上下文拥有，不得复制回固定提示形成双重事实来源。

Agent Loop 对已完成的模型/工具循环计步，运行中 steer 只结束当前 attempt 并立即重发，不得消耗八步业务预算。每个 requestId 同时只能有一个控制句柄；整轮最多运行 20 分钟，单工具最多运行 6 分钟，取消和总时限必须覆盖 MCP discovery、Provider、审批等待与工具执行。启动 command 只有在新 checkpoint 已原子落盘后才返回成功；恢复旧任务时先写新记录再删旧记录，不允许出现“恢复卡已消失但新任务未建立”的窗口。已获批写工具在收到确定结果前标记为不确定外部写入；此时取消、超时或进程中断必须保留 checkpoint，并提醒用户先检查目标状态，不能自动重放。

Provider 传输只可在连接失败或收到明确的 408/429/500/502/503/504 且尚未消费响应流时执行最多两次自动重试；必须尊重有上限的 `Retry-After`。一旦开始读取 SSE，禁止自动重放整轮，避免重复正文、工具调用和计费。HTTP 只限制连接与响应启动时间，长篇生成使用逐块流空闲超时，不得用整次请求总时长截断持续输出。

Provider HTTP 错误先按结构化 code/message 识别真实业务原因，再参考状态码；HTTP 402 以及余额不足、套餐与账单停用文案即使包装在 HTTP 429 中，也必须归为不可重试的账单错误，不能误报为普通请求失败或流量限制。面向作者的错误只显示本地化原因、操作建议和 HTTP 状态，不拼接 Provider 原始英文、组织 ID、账号标识或疑似密钥；原始有界详情只留在传输层诊断对象中。

MiniMax 使用官方推荐的 Anthropic-compatible Messages 入口，以结构化 thinking/text 块承载推理和最终回答；不得继续把 OpenAI-compatible content 中的 `<think>` 标签当正文渲染，也不得在 renderer 用字符串替换补救 Provider 协议。thinking 块沿既有 reasoning 事件进入可展开运行时间线，text 块才进入最终回答，并在工具续轮中保留完整 block history。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
