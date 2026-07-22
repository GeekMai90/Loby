//! [INPUT]: 依赖 agent/ 下的 app-server、附件、会话、能力发现、事件、进程、协议、quick prompt 与 runtime 子模块
//! [OUTPUT]: 向 crate 提供 app_server、assistant_attachments、conversation_store、discovery、events、process、protocol、quick_prompt_store 等受控能力
//! [POS]: 本地 AI agent 领域，封装 Codex 进程、协议、流式事件与会话附件持久化
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
pub(crate) mod app_server;
pub(crate) mod assistant_attachments;
pub(crate) mod conversation_store;
pub(crate) mod discovery;
pub(crate) mod events;
pub(crate) mod process;
pub(crate) mod protocol;
pub(crate) mod quick_prompt_store;
pub(crate) mod runtime;
