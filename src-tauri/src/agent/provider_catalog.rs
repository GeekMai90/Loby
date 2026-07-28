//! [INPUT]: 依赖共享 Agent 模型目录契约
//! [OUTPUT]: 向模型发现与 Provider runtime 提供封闭 Provider id 归一化和已接入模型、上下文、推理档位目录
//! [POS]: agent 的 Provider capability catalog，独立于 HTTP transport、凭证读取与会话状态
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use crate::models::{AgentModelCatalog, AgentModelOption, AgentReasoningLevel, AgentServiceTier};

pub(super) fn normalize_provider(value: &str) -> Result<String, String> {
    let normalized = value.trim().to_ascii_lowercase();
    match normalized.as_str() {
        "openai-api"
        | "anthropic-api"
        | "qwen-api"
        | "minimax-api"
        | "deepseek-api"
        | "kimi-api"
        | "openai-compatible"
        | "chatgpt-subscription" => Ok(normalized),
        _ => Err("请选择受支持的 AI Provider。".to_string()),
    }
}

pub(super) fn model_catalog(provider: &str) -> Result<AgentModelCatalog, String> {
    let provider = normalize_provider(provider)?;
    let models = match provider.as_str() {
        "openai-api" => vec![
            model(
                "gpt-5.6-terra",
                "GPT-5.6 Terra",
                "质量、速度与成本平衡",
                true,
                true,
            ),
            model("gpt-5.6-sol", "GPT-5.6 Sol", "复杂专业任务", true, true),
            model(
                "gpt-5.6-luna",
                "GPT-5.6 Luna",
                "高频、成本敏感任务",
                true,
                true,
            ),
        ],
        "chatgpt-subscription" => vec![
            chatgpt_fallback_model(
                "gpt-5.6-sol",
                "GPT-5.6-Sol",
                "最新的前沿 Agent 模型",
                &["low", "medium", "high", "xhigh", "max", "ultra"],
                "low",
            ),
            chatgpt_fallback_model(
                "gpt-5.6-terra",
                "GPT-5.6-Terra",
                "质量、速度与成本平衡的 Agent 模型",
                &["low", "medium", "high", "xhigh", "max", "ultra"],
                "medium",
            ),
            chatgpt_fallback_model(
                "gpt-5.6-luna",
                "GPT-5.6-Luna",
                "快速且经济的 Agent 模型",
                &["low", "medium", "high", "xhigh", "max"],
                "medium",
            ),
            model(
                "gpt-5.5",
                "GPT-5.5",
                "ChatGPT 订阅通用高质量模型",
                false,
                true,
            ),
            model("gpt-5.4", "GPT-5.4", "ChatGPT 订阅稳定模型", false, true),
            model(
                "gpt-5.4-mini",
                "GPT-5.4 Mini",
                "ChatGPT 订阅低延迟模型",
                false,
                true,
            ),
            model(
                "gpt-5.3-codex-spark",
                "GPT-5.3 Codex Spark",
                "ChatGPT 订阅快速工具调用模型",
                false,
                true,
            ),
        ],
        "anthropic-api" => vec![
            model(
                "claude-sonnet-5",
                "Claude Sonnet 5",
                "Anthropic Messages API 通用写作模型",
                false,
                true,
            ),
            model(
                "claude-opus-5",
                "Claude Opus 5",
                "Anthropic Messages API 高质量模型",
                false,
                true,
            ),
            model(
                "claude-haiku-4-5-20251001",
                "Claude Haiku 4.5",
                "Anthropic Messages API 低延迟模型",
                false,
                true,
            ),
        ],
        "qwen-api" => vec![
            model_with_reasoning(
                "qwen3.7-plus",
                "Qwen 3.7 Plus",
                "千问通用高质量模型",
                200_000,
                &["low", "medium", "high"],
                "medium",
            ),
            model_with_reasoning(
                "qwen3.7-max",
                "Qwen 3.7 Max",
                "千问复杂任务模型",
                200_000,
                &["low", "medium", "high"],
                "high",
            ),
            model_with_reasoning(
                "qwen3.6-flash",
                "Qwen 3.6 Flash",
                "千问低延迟模型",
                200_000,
                &["low", "medium", "high"],
                "low",
            ),
        ],
        "minimax-api" => vec![
            model_with_fixed_reasoning(
                "MiniMax-M2.7",
                "MiniMax M2.7",
                "MiniMax 通用 Agent 模型",
                204_800,
            ),
            model_with_fixed_reasoning(
                "MiniMax-M2.7-highspeed",
                "MiniMax M2.7 Highspeed",
                "MiniMax 低延迟模型",
                204_800,
            ),
            model_with_fixed_reasoning("MiniMax-M2.5", "MiniMax M2.5", "MiniMax 稳定模型", 204_800),
        ],
        "deepseek-api" => vec![
            model_with_reasoning(
                "deepseek-v4-flash",
                "DeepSeek V4 Flash",
                "DeepSeek 高性价比 Agent 模型",
                1_000_000,
                &["high", "max"],
                "high",
            ),
            model_with_reasoning(
                "deepseek-v4-pro",
                "DeepSeek V4 Pro",
                "DeepSeek 高质量复杂任务模型",
                1_000_000,
                &["high", "max"],
                "high",
            ),
        ],
        "kimi-api" => vec![
            model_with_reasoning(
                "kimi-k2.6",
                "Kimi K2.6",
                "Kimi 通用多模态 Agent 模型",
                262_144,
                &["disabled", "enabled"],
                "enabled",
            ),
            model_with_reasoning(
                "kimi-k2.5",
                "Kimi K2.5",
                "Kimi 稳定 Agent 模型",
                262_144,
                &["disabled", "enabled"],
                "enabled",
            ),
            model_with_reasoning(
                "kimi-k2-thinking",
                "Kimi K2 Thinking",
                "Kimi 固定深度思考模型",
                262_144,
                &["enabled"],
                "enabled",
            ),
        ],
        "openai-compatible" => vec![model(
            "custom",
            "自定义模型",
            "由兼容服务的 model 设置决定",
            false,
            false,
        )],
        _ => unreachable!("provider was normalized"),
    };
    let current_reasoning_effort = models
        .first()
        .filter(|model| model.supports_reasoning)
        .map(|model| model.default_reasoning_level.as_str())
        .unwrap_or_default()
        .to_string();
    Ok(AgentModelCatalog {
        fetched_at: String::new(),
        current_model: models
            .first()
            .map(|model| model.slug.clone())
            .unwrap_or_default(),
        current_reasoning_effort,
        models,
    })
}

fn model(
    slug: &str,
    display_name: &str,
    description: &str,
    quick_mode: bool,
    supports_reasoning: bool,
) -> AgentModelOption {
    let context_window_tokens = if slug.starts_with("claude-") {
        200_000
    } else if slug == "custom" {
        64_000
    } else {
        128_000
    };
    AgentModelOption {
        slug: slug.to_string(),
        display_name: display_name.to_string(),
        description: description.to_string(),
        context_window_tokens,
        supports_reasoning,
        default_reasoning_level: if supports_reasoning { "medium" } else { "" }.to_string(),
        supported_reasoning_levels: if supports_reasoning {
            ["low", "medium", "high"]
                .into_iter()
                .map(|effort| AgentReasoningLevel {
                    effort: effort.to_string(),
                    description: effort.to_string(),
                })
                .collect()
        } else {
            Vec::new()
        },
        additional_speed_tiers: if quick_mode {
            vec!["priority".to_string()]
        } else {
            Vec::new()
        },
        service_tiers: if quick_mode {
            vec![AgentServiceTier {
                id: "priority".to_string(),
                name: "快速".to_string(),
                description: "Provider 支持时请求低延迟服务层".to_string(),
            }]
        } else {
            Vec::new()
        },
    }
}

fn model_with_context(
    slug: &str,
    display_name: &str,
    description: &str,
    context_window_tokens: u64,
) -> AgentModelOption {
    model_with_reasoning(
        slug,
        display_name,
        description,
        context_window_tokens,
        &[],
        "",
    )
}

fn model_with_fixed_reasoning(
    slug: &str,
    display_name: &str,
    description: &str,
    context_window_tokens: u64,
) -> AgentModelOption {
    let mut model = model_with_context(slug, display_name, description, context_window_tokens);
    model.supports_reasoning = true;
    model
}

fn chatgpt_fallback_model(
    slug: &str,
    display_name: &str,
    description: &str,
    reasoning_levels: &[&str],
    default_reasoning_level: &str,
) -> AgentModelOption {
    let mut model = model_with_reasoning(
        slug,
        display_name,
        description,
        272_000,
        reasoning_levels,
        default_reasoning_level,
    );
    model.additional_speed_tiers = vec!["fast".to_string()];
    model.service_tiers = vec![AgentServiceTier {
        id: "priority".to_string(),
        name: "快速".to_string(),
        description: "1.5 倍速度，消耗更多订阅用量".to_string(),
    }];
    model
}

fn model_with_reasoning(
    slug: &str,
    display_name: &str,
    description: &str,
    context_window_tokens: u64,
    reasoning_levels: &[&str],
    default_reasoning_level: &str,
) -> AgentModelOption {
    AgentModelOption {
        slug: slug.to_string(),
        display_name: display_name.to_string(),
        description: description.to_string(),
        context_window_tokens,
        supports_reasoning: !reasoning_levels.is_empty(),
        default_reasoning_level: default_reasoning_level.to_string(),
        supported_reasoning_levels: reasoning_levels
            .iter()
            .map(|effort| AgentReasoningLevel {
                effort: (*effort).to_string(),
                description: (*effort).to_string(),
            })
            .collect(),
        additional_speed_tiers: Vec::new(),
        service_tiers: Vec::new(),
    }
}
