# agent/ - 本地 AI agent 领域

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

<member>
app_server.rs - Codex app-server JSON-RPC loop 与 approval wait
assistant_attachments.rs - process-scoped 临时图片与受控路径解析
conversation_store.rs - AI 会话 JSON 持久化
discovery.rs - skill、model 与 CLI 能力发现
events.rs - app-server notification 到稳定前端 event 的翻译
process.rs - 可执行文件解析与超时进程工具
protocol.rs - 纯 JSON-RPC request/response 构造
quick_prompt_store.rs - quick prompts 持久化
runtime.rs - agent commands、managed state、取消与 stream 生命周期
</member>

该模块不拥有文稿持久化；写作上下文通过经过校验的路径与 command 输入进入。临时附件必须限制在当前进程会话目录。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
