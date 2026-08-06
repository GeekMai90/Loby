//! [INPUT]: 依赖 agent/ 下的 Provider、连接诊断、传输政策、流协议、文稿提案、凭证、联网搜索、图片生成、MCP、工具、附件、会话、Skill、能力发现、事件、quick prompt 与 runtime 子模块
//! [OUTPUT]: 向 crate 提供 Loby-owned Agent Runtime、真实连接验证、具备有界重试与流空闲检测的 Provider、结构化提案、自动搜索路由、图片 Provider、Tool/MCP/Skill 适配及会话附件持久化能力
//! [POS]: 本地 AI agent 领域，封装模型传输、工具编排、安全凭证与稳定前端事件
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
pub(crate) mod assistant_attachments;
pub(crate) mod chatgpt_auth;
pub(crate) mod chatgpt_models;
pub(crate) mod connection_validation;
pub(crate) mod conversation_store;
pub(crate) mod conversation_title;
pub(crate) mod credentials;
pub(crate) mod discovery;
pub(crate) mod document_summary;
pub(crate) mod events;
pub(crate) mod image_generation;
pub(crate) mod mcp;
pub(crate) mod proposals;
pub(crate) mod provider_catalog;
pub(crate) mod provider_chat;
pub(crate) mod provider_conversation;
pub(crate) mod provider_http;
pub(crate) mod provider_stream;
#[cfg(test)]
mod provider_tests;
pub(crate) mod providers;
pub(crate) mod quick_prompt_store;
pub(crate) mod run_checkpoint;
pub(crate) mod runtime;
pub(crate) mod runtime_events;
pub(crate) mod runtime_tools;
pub(crate) mod skill_format;
pub(crate) mod skill_import;
pub(crate) mod skill_store;
pub(crate) mod tools;
pub(crate) mod web_search;
