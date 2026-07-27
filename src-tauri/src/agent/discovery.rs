//! [INPUT]: 依赖 Provider 模型目录
//! [OUTPUT]: 向 renderer 提供按 Provider 隔离的模型目录
//! [POS]: 本地 AI agent 领域的 Provider 能力发现层；Skill 生命周期归 skill_store
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use super::providers;
use crate::models::AgentModelCatalog;

#[tauri::command]
pub(crate) fn list_agent_models(provider: String) -> Result<AgentModelCatalog, String> {
    providers::model_catalog(&provider)
}
