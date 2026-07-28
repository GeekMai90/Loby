//! [INPUT]: 依赖静态 Provider capability catalog 与 ChatGPT 账号实时模型目录
//! [OUTPUT]: 向 renderer 提供按 Provider 隔离的模型目录；ChatGPT 在线发现失败时保留本地安全回退
//! [POS]: 本地 AI agent 领域的 Provider 能力发现协调层；不拥有 OAuth、网络传输或 Skill 生命周期
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use super::{chatgpt_models, providers};
use crate::models::AgentModelCatalog;

#[tauri::command]
pub(crate) async fn list_agent_models(provider: String) -> Result<AgentModelCatalog, String> {
    let provider = providers::normalize_provider(&provider)?;
    if provider == "chatgpt-subscription" {
        return match chatgpt_models::model_catalog().await {
            Ok(catalog) => Ok(catalog),
            Err(_) => providers::model_catalog(&provider),
        };
    }
    providers::model_catalog(&provider)
}
