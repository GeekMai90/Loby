//! [INPUT]: 依赖 agent/ 下的 Provider、凭证、MCP、工具、附件、会话、Skill、能力发现、事件、quick prompt 与 runtime 子模块
//! [OUTPUT]: 向 crate 提供 Loby-owned Agent Runtime、Provider/Tool/MCP/Skill 适配及会话附件持久化能力
//! [POS]: 本地 AI agent 领域，封装模型传输、工具编排、安全凭证与稳定前端事件
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
pub(crate) mod assistant_attachments;
pub(crate) mod chatgpt_auth;
pub(crate) mod conversation_store;
pub(crate) mod credentials;
pub(crate) mod discovery;
pub(crate) mod events;
pub(crate) mod mcp;
pub(crate) mod providers;
pub(crate) mod quick_prompt_store;
pub(crate) mod runtime;
pub(crate) mod skill_format;
pub(crate) mod skill_import;
pub(crate) mod skill_store;
pub(crate) mod tools;
