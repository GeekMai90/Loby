# agent/ - Loby-owned Agent Runtime

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

<member>
assistant_attachments.rs - process-scoped 临时附件存储，校验图片与受支持文档并只向 Provider 暴露可信路径
chatgpt_auth.rs - ChatGPT Device OAuth、token 刷新与去敏账号状态，向订阅 Provider 提供系统钥匙串内的访问上下文
conversation_store.rs - 写作库内 AI 会话 JSON 持久化，不拥有正文事实
credentials.rs - Provider 与 MCP secret 的系统钥匙串边界，renderer 只能读取配置状态
discovery.rs - 应用、用户配置目录和当前写作库内 Agent Skills 发现，以及 Provider 模型目录命令
events.rs - Loby request-scoped stream、activity、approval、usage 与 metric 事件构造
mcp.rs - MCP server 配置、官方 transport 连接、tool 发现和命名空间调用
providers.rs - OpenAI Responses、ChatGPT subscription Responses、Anthropic Messages 与 OpenAI-compatible 协议适配
quick_prompt_store.rs - quick prompts 持久化
runtime.rs - 有限 Agent Loop、取消、运行中引导、工具审批和 Tauri command 生命周期
tools.rs - 本地 Markdown 只读工具、Tavily 联网搜索与 OpenAI 图片生成工具
</member>

该模块不拥有文稿持久化。Markdown 工具只能访问当前写作库内非隐藏的 `.md` 文件，拒绝符号链接和路径逃逸；临时附件限制在当前进程会话目录；Provider、联网搜索、图片和 MCP 凭证只进入原生安全存储。任意写入型 MCP tool 必须先经过 Loby 审批，正文修改仍只通过可审阅的 `loby-change` 或 `loby-action` 协议进入编辑器。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
