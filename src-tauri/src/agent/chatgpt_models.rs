//! [INPUT]: 依赖 ChatGPT OAuth 访问上下文、Provider HTTP 传输政策与 Codex `/models` 响应
//! [OUTPUT]: 向模型发现层提供当前 ChatGPT 账号真实可见的模型、上下文、思考档位与快速服务层目录
//! [POS]: agent 的 ChatGPT 订阅模型发现适配器；远端目录是账号能力事实源，静态回退由 provider_catalog 独立维护
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md

use super::{chatgpt_auth, provider_http};
use crate::models::{AgentModelCatalog, AgentModelOption, AgentReasoningLevel, AgentServiceTier};
use reqwest::header;
use serde::Deserialize;
use serde_json::Value;
use std::collections::HashSet;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const CHATGPT_MODELS_URL: &str = "https://chatgpt.com/backend-api/codex/models";
const MODELS_REFRESH_TIMEOUT: Duration = Duration::from_secs(5);
const FALLBACK_CONTEXT_WINDOW_TOKENS: u64 = 128_000;

#[derive(Debug, Deserialize)]
struct RemoteModelsResponse {
    #[serde(default)]
    models: Vec<RemoteModel>,
}

#[derive(Debug, Deserialize)]
struct RemoteModel {
    slug: String,
    #[serde(default)]
    display_name: String,
    description: Option<String>,
    default_reasoning_level: Option<String>,
    #[serde(default)]
    supported_reasoning_levels: Vec<RemoteReasoningLevel>,
    visibility: Option<String>,
    #[serde(default)]
    priority: i32,
    context_window: Option<u64>,
    max_context_window: Option<u64>,
    #[serde(default)]
    additional_speed_tiers: Vec<String>,
    #[serde(default)]
    service_tiers: Vec<RemoteServiceTier>,
}

#[derive(Debug, Deserialize)]
struct RemoteReasoningLevel {
    effort: String,
    #[serde(default)]
    description: String,
}

#[derive(Debug, Deserialize)]
struct RemoteServiceTier {
    id: String,
    #[serde(default)]
    name: String,
    #[serde(default)]
    description: String,
}

pub(super) async fn model_catalog() -> Result<AgentModelCatalog, String> {
    let access = chatgpt_auth::access().await?;
    let response = provider_http::send_provider_request(
        provider_http::http_client()?
            .get(CHATGPT_MODELS_URL)
            .query(&[("client_version", env!("CARGO_PKG_VERSION"))])
            .timeout(MODELS_REFRESH_TIMEOUT)
            .bearer_auth(access.token)
            .header("ChatGPT-Account-Id", access.account_id)
            .header("originator", "loby")
            .header(header::ACCEPT, "application/json"),
        "ChatGPT",
    )
    .await
    .map_err(|error| error.to_string())?;
    let value = provider_http::read_json_response(response, "ChatGPT")
        .await
        .map_err(|error| error.to_string())?;
    catalog_from_value(value)
}

fn catalog_from_value(value: Value) -> Result<AgentModelCatalog, String> {
    let response = serde_json::from_value::<RemoteModelsResponse>(value)
        .map_err(|_| "ChatGPT 返回了无法识别的模型目录。".to_string())?;
    let mut remote_models = response
        .models
        .into_iter()
        .filter(|model| model.visibility.as_deref().unwrap_or("list") == "list")
        .collect::<Vec<_>>();
    remote_models.sort_by_key(|model| model.priority);

    let mut seen = HashSet::new();
    let models = remote_models
        .into_iter()
        .filter(|model| valid_model_slug(&model.slug) && seen.insert(model.slug.clone()))
        .map(agent_model_option)
        .collect::<Vec<_>>();
    let current = models
        .first()
        .ok_or_else(|| "当前 ChatGPT 账号没有返回可选择的 Codex 模型。".to_string())?;

    Ok(AgentModelCatalog {
        fetched_at: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_millis().to_string())
            .unwrap_or_default(),
        current_model: current.slug.clone(),
        current_reasoning_effort: current.default_reasoning_level.clone(),
        models,
    })
}

fn agent_model_option(remote: RemoteModel) -> AgentModelOption {
    let supported_reasoning_levels = remote
        .supported_reasoning_levels
        .into_iter()
        .filter(|level| valid_identifier(&level.effort))
        .take(16)
        .map(|level| AgentReasoningLevel {
            description: bounded_text(
                if level.description.trim().is_empty() {
                    &level.effort
                } else {
                    &level.description
                },
                160,
            ),
            effort: level.effort,
        })
        .collect::<Vec<_>>();
    let default_reasoning_level = remote
        .default_reasoning_level
        .filter(|effort| {
            supported_reasoning_levels
                .iter()
                .any(|level| level.effort == *effort)
        })
        .or_else(|| {
            supported_reasoning_levels
                .first()
                .map(|level| level.effort.clone())
        })
        .unwrap_or_default();
    let additional_speed_tiers = remote
        .additional_speed_tiers
        .into_iter()
        .filter(|tier| valid_identifier(tier))
        .take(8)
        .collect();
    let service_tiers = remote
        .service_tiers
        .into_iter()
        .filter(|tier| valid_identifier(&tier.id))
        .take(8)
        .map(|tier| AgentServiceTier {
            id: tier.id,
            name: bounded_text(&tier.name, 64),
            description: bounded_text(&tier.description, 160),
        })
        .collect();

    AgentModelOption {
        display_name: if remote.display_name.trim().is_empty() {
            remote.slug.clone()
        } else {
            bounded_text(&remote.display_name, 96)
        },
        slug: remote.slug,
        description: bounded_text(remote.description.as_deref().unwrap_or_default(), 240),
        context_window_tokens: remote
            .context_window
            .or(remote.max_context_window)
            .filter(|tokens| (16_000..=10_000_000).contains(tokens))
            .unwrap_or(FALLBACK_CONTEXT_WINDOW_TOKENS),
        supports_reasoning: !supported_reasoning_levels.is_empty(),
        default_reasoning_level,
        supported_reasoning_levels,
        additional_speed_tiers,
        service_tiers,
    }
}

fn valid_model_slug(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 128
        && value.chars().all(|character| {
            character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.' | ':' | '/')
        })
}

fn valid_identifier(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 64
        && value
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_'))
}

fn bounded_text(value: &str, max_chars: usize) -> String {
    value.trim().chars().take(max_chars).collect()
}

#[cfg(test)]
mod tests {
    use super::catalog_from_value;
    use serde_json::json;

    #[test]
    fn remote_catalog_uses_visible_account_models_and_real_capabilities() {
        let catalog = catalog_from_value(json!({
            "models": [
                {
                    "slug": "hidden-model",
                    "display_name": "Hidden",
                    "visibility": "hide",
                    "priority": 0
                },
                {
                    "slug": "gpt-5.6-terra",
                    "display_name": "GPT-5.6-Terra",
                    "description": "Balanced agentic model",
                    "default_reasoning_level": "medium",
                    "supported_reasoning_levels": [
                        { "effort": "low", "description": "Fast" },
                        { "effort": "medium", "description": "Balanced" },
                        { "effort": "ultra", "description": "Deep delegation" }
                    ],
                    "visibility": "list",
                    "priority": 2,
                    "context_window": 272000,
                    "additional_speed_tiers": ["fast"],
                    "service_tiers": [{ "id": "priority", "name": "Fast", "description": "1.5x speed" }]
                },
                {
                    "slug": "gpt-5.6-sol",
                    "display_name": "GPT-5.6-Sol",
                    "default_reasoning_level": "low",
                    "supported_reasoning_levels": [{ "effort": "low", "description": "Fast" }],
                    "visibility": "list",
                    "priority": 1,
                    "max_context_window": 272000
                }
            ]
        }))
        .unwrap();

        assert_eq!(catalog.current_model, "gpt-5.6-sol");
        assert_eq!(catalog.current_reasoning_effort, "low");
        assert_eq!(catalog.models.len(), 2);
        assert_eq!(catalog.models[0].context_window_tokens, 272_000);
        assert!(catalog.models[1]
            .supported_reasoning_levels
            .iter()
            .any(|level| level.effort == "ultra"));
        assert_eq!(catalog.models[1].service_tiers[0].id, "priority");
    }

    #[test]
    fn remote_catalog_rejects_an_empty_visible_picker() {
        let error = catalog_from_value(json!({
            "models": [{ "slug": "hidden-model", "visibility": "hide", "priority": 1 }]
        }))
        .unwrap_err();
        assert_eq!(error, "当前 ChatGPT 账号没有返回可选择的 Codex 模型。");
    }
}
