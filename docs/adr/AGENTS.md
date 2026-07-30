# adr/ - 架构决策记录

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

<member>
0001-use-tauri.md - 选择 Tauri 而非 Electron 的桌面外壳决策与验证边界
0002-local-first-markdown.md - 以本地 Markdown 为内容事实来源的数据决策
0003-ai-through-local-cli.md - 通过本地 CLI 集成 AI 能力的运行时决策
0004-quality-gates.md - 本地质量门禁、Git hooks 与 PR review 的交付决策
0005-serialize-local-persistence.md - 本地持久化串行化、flush 与原子替换决策
0006-loby-owned-agent-runtime.md - 废止本地 CLI 方案并由 Loby 拥有 Provider、Agent Loop、Tool、Skill、MCP 与凭证边界
0007-open-agent-skills.md - 采用开放 Agent Skills 包格式、写作库安装位置、显式迁移与渐进激活边界
0008-typed-agent-events-and-proposals.md - 参考成熟开源 Agent 的类型化 stream、interrupt 与 approval 模式，固化 Loby 文稿提案和旧协议退役边界
0009-durable-conversation-context.md - 参考 Codex、OpenHands 与 OpenCode，分离完整会话事实和 token-aware 模型视图，并固化附件、分支与显式恢复边界
0010-provider-transport-resilience.md - 参考 Codex、OpenCode 与 OpenHands，固化 Provider 有限重试、分层超时、类型化错误与显式模型能力边界
0011-bounded-writing-agent-loop.md - 参考 Codex、OpenHands 与 OpenCode，固化写作 Agent 的 attempt/step 分离、唯一请求控制、统一时限与不确定写入恢复
0012-semantic-conversation-checkpoints.md - 让压缩 checkpoint 按模型可见语义而非仅消息 ID 失效，并保留有界写作动作与提议正文
0013-closed-tool-effects.md - 以封闭 ToolEffect、防御性执行校验和 32 MB 搜索预算阻止工具权限降级与无界写作库扫描
0014-defense-in-depth-writing-proposals.md - 以原生深层校验、文稿目标绑定和图片稳定路径提升固化作者确认与可重试写入边界
0015-sealed-agent-event-lifecycles.md - 以封闭事件 kind、稳定 item identity、原位归并和 run 终态封口保证实时与历史状态一致
0016-bounded-skill-and-mcp-adapters.md - 以三层 Skill 加载、有界资源读取、MCP 并发目录缓存和三重工具身份固化写作扩展边界
0017-durable-recovery-handoff.md - 以启动前 checkpoint、先写后删恢复交接和已验证会话备份消除无记录窗口
0018-project-bound-help-center-sync.md - 以项目级非敏感绑定、版本化所有权清单和非强制原子提交连接本地 Markdown 与 Starlight 帮助中心
0019-project-bound-github-adapters.md - 统一 GitHub 目标 registry、Hugo/Starlight 适配器与项目一对一绑定，替代帮助中心专属配置模型
</member>

ADR 只记录难以逆转、影响多模块或需要长期解释“为什么”的决策。新 ADR 使用递增编号，不重写既有记录来伪造历史。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
