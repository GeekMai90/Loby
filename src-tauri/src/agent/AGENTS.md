# agent/ - Loby-owned Agent Runtime

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

<member>
assistant_attachments.rs - composer 临时附件与写作库 `.loby/ai/attachments` 内容寻址存储，校验图片/文档并只向 Provider 暴露受管路径
chatgpt_auth.rs - ChatGPT Device OAuth、token 刷新与去敏账号状态，向订阅 Provider 提供应用内访问上下文
conversation_store.rs - 写作库内 AI 会话 JSON 持久化，不拥有正文事实
credentials.rs - Provider、ChatGPT OAuth 与 MCP secret 的当前用户 app-config 文件边界，renderer 只能读取配置状态
discovery.rs - 按 Provider 隔离的模型目录命令
events.rs - Agent Event Protocol v2 构造器，统一 sequence、run phase、typed activity 生命周期、可见性、proposal、approval、usage 与 terminal
image_generation.rs - Provider-neutral 图片能力路由，使用 `gpt-image-2` 适配 ChatGPT 订阅 Codex Images 与 OpenAI Images API，并只产出临时成果
mcp.rs - MCP server 配置、官方 transport 连接、tool 发现和命名空间调用
provider_conversation.rs - Provider-neutral 历史角色投影，校验 user/assistant 白名单并适配 Anthropic 相邻角色合并规则
provider_stream.rs - OpenAI Responses 与 Anthropic Messages 的增量 SSE 解码、类型化事件发布和完整响应重建
providers.rs - OpenAI Responses、ChatGPT subscription Responses、Anthropic Messages 与 OpenAI-compatible 请求适配
provider_tests.rs - Provider 归一化、模型目录与响应解析的原生隔离回归测试，仅进入 test build
proposals.rs - 严格文稿提案工具定义、payload 校验与作者控制边界
quick_prompt_store.rs - quick prompts 持久化
runtime.rs - 有限 Agent Loop 与运行状态唯一所有者，显式驱动 Provider 回合、steer/cancel 和 request 终态
runtime_events.rs - Provider stream 到 Agent Event Protocol v2 的可观测性适配层，将模型摘要清理为有界中文纯文本、封口 reasoning 并按工具标识符确定 activity kind
runtime_tools.rs - 工具执行子状态机，独占 proposal 发布、审批等待、工具 item 生命周期与结果截断
run_checkpoint.rs - 写作库内未完成运行日志，重启后只恢复为显式重试/放弃决策，禁止自动重放写工具
skill_format.rs - 开放 Agent Skills frontmatter 解析、名称规范化与 Loby 兼容性诊断
skill_import.rs - 设置选择或对话明确路径下目录、SKILL.md、ZIP/.skill 包的统一安全预检、解包与复制安装
skill_store.rs - 内置/写作库 Skill 发现、创建、更新、启停、删除、激活与资源安全读取
tools.rs - 本地 Markdown、Skill 外部路径导入、Tavily 搜索及图片生成等内置工具的 schema、参数校验与分发
</member>

该模块不拥有文稿持久化。Markdown 工具只能访问当前写作库内非隐藏的 `.md` 文件，拒绝符号链接和路径逃逸；Skill 只从 bundle 与当前写作库 `.agents/skills` 发现，外部导入只接受用户明确提供的单个路径并拒绝包内符号链接，scripts 不可执行，图片工具也只能上传已启用 Skill 包内通过格式与体积校验的参考图；composer 附件先进入进程临时目录，发送时按内容哈希提升到当前写作库受管目录，历史轮次只允许复用这两个根目录内的文件。图片自动路由优先复用当前可生图的对话 Provider，再选择已配置的 ChatGPT 订阅或 OpenAI API；显式选择不静默跨计费服务回退。Provider、联网搜索、图片、ChatGPT OAuth 和 MCP 凭证只进入当前用户私有的 app-config 文件，启动不访问系统 Keychain。任意写入型 Skill/MCP tool 必须先经过 Loby 审批；正文修改由严格 `propose_*` 工具发出结构化建议，再进入 renderer 既有动作确认与 diff 审阅，runtime 不直接写正文。

Runtime 必须为每个 request 发出单调 sequence，并独占 `runPhase + activeItemId`；activity 必须携带稳定 kind/state/visibility，任何 queued/running/awaitingApproval item 都要收到 completed/failed/cancelled。Provider 记账与 MCP discovery 标为 diagnostic，reasoning 使用一个稳定 item；Provider 原始 reasoning summary 是不可信展示输入，进入 renderer 前必须去除 Markdown、限制长度并对非中文内容使用本地化兜底，renderer 禁止从 title 或事件尾项重建状态。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
