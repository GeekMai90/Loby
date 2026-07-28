# ADR 0016：有界 Skill 与 MCP 适配器

日期：2026-07-28

## 状态

已接受

## 背景

Skill 与 MCP 都会扩大 Agent Runtime 可见的能力，但两者的风险并不相同：Skill 是由作者可读的本地工作流，容易因说明过长或携带宿主专用能力污染上下文；MCP 由外部 server 动态提供工具，容易在首轮发现、名称转换、超大 schema 和审批后配置变化上失控。

成熟通用 Agent 会支持大量 Skill、长期 MCP 连接、子进程和广泛工具。Loby 是本地写作应用：扩展能力必须让位于正文、对话和作者审阅，不能把应用变成无界的通用进程宿主。

## 开源与标准对照

- [Codex skill-creator](https://github.com/openai/codex/blob/main/codex-rs/skills/src/assets/samples/skill-creator/SKILL.md) 要求 `SKILL.md` 具备 name、description 和正文，并把 metadata、完整工作流和 references/assets 分为渐进加载层级；官方建议主说明保持在 500 行以内。
- [Codex app-server Skills 协议](https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md#skills) 把显式 Skill 作为 turn input，对按 cwd 的 Skill 目录结果缓存，并用 changed/forceReload 做失效。Loby 不复制 Codex thread 或 app-server，只采用相同的渐进披露思路。
- [MCP 2025-11-25 Tools 规范](https://modelcontextprotocol.io/specification/2025-11-25/server/tools) 把 tool name、title、description 和 schema 分开，建议名称为 1–128 位 ASCII 字母数字、下划线、连字符或点，并要求 client 将 server annotations 视为不可信、保留 human-in-the-loop。
- [MCP 官方 Rust SDK](https://github.com/modelcontextprotocol/rust-sdk) 提供 stdio、Streamable HTTP、initialize/cancel 生命周期和类型化模型；Loby 复用 SDK，不自行重写 transport。

## 决策

1. Skill 只在 frontmatter 的 `name` / `description` 和 Markdown 正文都存在时成立；目录名不再替代缺失的 `name`。`SKILL.md` 超过 48 KB 或 500 行时进入待适配，细节必须拆到 references。
2. system prompt 只放已启用 Skill 的 name/description catalog；触发后才加载 `SKILL.md`，资源再按需分页。模型可见文件目录上限为 12 KB，文本资源单次请求最多 32 KB，序列化后继续收紧到 48 KB；二进制资源不返回本机绝对路径。
3. 导入和创建仍落在当前写作库，必须复制、原子写入并经过审批；不扫描其他 Agent 的全局目录，scripts 保留但不执行。
4. 已启用 MCP server 并发发现，结果按 server id 和运行配置指纹缓存 5 分钟，再按设置顺序合并。每 server 最多 64 工具、每轮总计 128、单 schema 最大 64 KB、title/description 最大 2,000 字符，超限项转为可诊断 warning。
5. MCP tool 有三个身份：原始 transport name、面向作者的 display name、面向 Provider 的有界 alias。标准名保持原样；安全但非标准的名称被记录 warning 并生成最多 64 字符的清洗别名，裁剪时加 12 位 hash 防冲突。执行始终使用绑定的原始名称。
6. 工具发现时把 transport、command/URL、args 和 secret env 名生成指纹；审批后调用前重读当前配置，指纹变化则拒绝。HTTP client 不跟随重定向，避免 bearer 或用户审批漂移到新 endpoint。
7. 所有 MCP tool 继续映射为 `write` 并逐次审批，`readOnlyHint` 仅用于展示。server annotations 不能提升本地权限。
8. V1 缓存 tool catalog，但发现和调用各自建立短会话并在完成/取消后关闭；不引入常驻 MCP 连接管理器。这会多一次握手，但避免桌面写作应用长期持有任意子进程、过期凭证和不可见连接状态。

## 明确不做

- 不执行 Skill scripts、hooks 或声明的任意 shell；
- 不自动读取 Codex、Claude 或其他应用的 Skill/MCP 目录和凭证；
- 不把 MCP resources/prompts/sampling 连带全部接入，目前只接入写作场景已有明确用途的 tools；
- 不为了省一次握手把 Loby 变成通用子进程宿主。

## 验证

- Skill 格式测试覆盖缺失 name/正文、伪结束分隔符、宿主依赖大小写和 48 KB/500 行边界；
- Skill Store 测试覆盖 UTF-8 分页、高转义文本输出预算、资源目录截断和二进制路径私密性；
- MCP 测试覆盖命名预算/别名冲突、非标准名兼容、server id 命名空间、配置指纹与缓存失效；
- Rust 定向测试、Clippy、TypeScript typecheck 与最终仓库门禁通过。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
