# adr/ - 架构决策记录

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

<member>
0001-use-tauri.md - 选择 Tauri 而非 Electron 的桌面外壳决策与验证边界
0002-local-first-markdown.md - 以本地 Markdown 为内容事实来源的数据决策
0003-ai-through-local-cli.md - 通过本地 CLI 集成 AI 能力的运行时决策
0004-quality-gates.md - 本地质量门禁、Git hooks 与 PR review 的交付决策
0005-serialize-local-persistence.md - 本地持久化串行化、flush 与原子替换决策
0006-loby-owned-agent-runtime.md - 废止本地 CLI 方案并由 Loby 拥有 Provider、Agent Loop、Tool、Skill、MCP 与凭证边界
</member>

ADR 只记录难以逆转、影响多模块或需要长期解释“为什么”的决策。新 ADR 使用递增编号，不重写既有记录来伪造历史。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
