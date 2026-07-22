//! [INPUT]: 依赖所属领域模型、受控文件系统或 Tauri 平台能力
//! [OUTPUT]: 向 crate 提供 app_server、assistant_attachments、conversation_store、discovery、events、process、protocol、quick_prompt_store 等受控能力
//! [POS]: 本地 AI agent 领域，封装 Codex 进程、协议、流式事件与会话附件持久化
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
//! [INPUT]: 依赖所属领域模型、受控文件系统或 Tauri 平台能力
//! [OUTPUT]: 向 crate 提供 app_server、assistant_attachments、conversation_store、discovery、events、process、protocol、quick_prompt_store 等受控能力
//! [POS]: native 共享基础层，为多个领域提供序列化、路径、Markdown 或系统能力
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
