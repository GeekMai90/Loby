# agent/ - Loby-owned Agent Runtime

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

<member>
assistant_attachments.rs - process-scoped 临时附件存储，校验图片与受支持文档并只向 Provider 暴露可信路径
chatgpt_auth.rs - ChatGPT Device OAuth、token 刷新与去敏账号状态，向订阅 Provider 提供应用内访问上下文
conversation_store.rs - 写作库内 AI 会话 JSON 持久化，不拥有正文事实
credentials.rs - Provider、ChatGPT OAuth 与 MCP secret 的当前用户 app-config 文件边界，renderer 只能读取配置状态
discovery.rs - 按 Provider 隔离的模型目录命令
events.rs - Loby request-scoped stream、activity、approval、usage 与 metric 事件构造
mcp.rs - MCP server 配置、官方 transport 连接、tool 发现和命名空间调用
providers.rs - OpenAI Responses、ChatGPT subscription Responses、Anthropic Messages 与 OpenAI-compatible 协议适配
quick_prompt_store.rs - quick prompts 持久化
runtime.rs - 有限 Agent Loop、取消、运行中引导、工具审批和 Tauri command 生命周期
skill_format.rs - 开放 Agent Skills frontmatter 解析、名称规范化与 Loby 兼容性诊断
skill_import.rs - 设置选择或对话明确路径下目录、SKILL.md、ZIP/.skill 包的统一安全预检、解包与复制安装
skill_store.rs - 内置/写作库 Skill 发现、创建、更新、启停、删除、激活与资源安全读取
tools.rs - 本地 Markdown、Skill 外部路径导入、Tavily 搜索与受限参考图输入的 OpenAI 图片生成工具
</member>

该模块不拥有文稿持久化。Markdown 工具只能访问当前写作库内非隐藏的 `.md` 文件，拒绝符号链接和路径逃逸；Skill 只从 bundle 与当前写作库 `.agents/skills` 发现，外部导入只接受用户明确提供的单个路径并拒绝包内符号链接，scripts 不可执行，图片工具也只能上传已启用 Skill 包内通过格式与体积校验的参考图；临时附件限制在当前进程会话目录；Provider、联网搜索、图片、ChatGPT OAuth 和 MCP 凭证只进入当前用户私有的 app-config 文件，启动不访问系统 Keychain。任意写入型 Skill/MCP tool 必须先经过 Loby 审批，正文修改仍只通过可审阅的 `loby-change` 或 `loby-action` 协议进入编辑器。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
