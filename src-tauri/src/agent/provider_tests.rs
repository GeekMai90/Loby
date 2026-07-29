//! [INPUT]: 依赖 agent::providers 的 Provider 归一化、目录与响应解析测试接口
//! [OUTPUT]: 提供 Provider adapter 的隔离回归测试，不进入生产构建
//! [POS]: Loby Agent 原生测试模块，避免传输实现因内联测试越过单文件职责边界
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use super::providers::{
    configure_openai_reasoning, model_catalog, normalize_compatible_url, normalize_provider,
    openai_function_tool, openai_output_text, openai_tool_calls,
};

#[test]
fn provider_names_are_closed_over_known_adapters() {
    assert_eq!(normalize_provider(" OpenAI-API ").unwrap(), "openai-api");
    assert_eq!(normalize_provider("QWEN-API").unwrap(), "qwen-api");
    assert_eq!(normalize_provider("minimax-api").unwrap(), "minimax-api");
    assert_eq!(normalize_provider("deepseek-api").unwrap(), "deepseek-api");
    assert_eq!(normalize_provider("kimi-api").unwrap(), "kimi-api");
    assert!(normalize_provider("Claude-Subscription").is_err());
    assert!(normalize_provider("unknown-provider").is_err());
    assert!(normalize_provider("claude").is_err());
}

#[test]
fn fixed_chat_providers_expose_their_real_reasoning_controls() {
    let qwen = model_catalog("qwen-api").unwrap();
    assert_eq!(qwen.current_model, "qwen3.7-plus");
    assert_eq!(qwen.current_reasoning_effort, "medium");

    let minimax = model_catalog("minimax-api").unwrap();
    assert!(minimax.models[0].supports_reasoning);
    assert!(minimax.models[0].supported_reasoning_levels.is_empty());

    let deepseek = model_catalog("deepseek-api").unwrap();
    assert_eq!(deepseek.current_reasoning_effort, "high");
    assert_eq!(deepseek.models[0].context_window_tokens, 1_000_000);

    let kimi = model_catalog("kimi-api").unwrap();
    assert_eq!(kimi.current_reasoning_effort, "enabled");
}

#[test]
fn compatible_url_requires_https_outside_debug_and_appends_v1() {
    assert_eq!(
        normalize_compatible_url("https://example.com/").unwrap(),
        "https://example.com/v1"
    );
    assert_eq!(
        normalize_compatible_url("https://example.com/v1").unwrap(),
        "https://example.com/v1"
    );
}

#[test]
fn openai_and_chatgpt_keep_strict_proposal_schemas() {
    let definition = super::proposals::definitions()
        .into_iter()
        .find(|tool| tool.name == super::proposals::PROPOSE_INSERT_IMAGE)
        .unwrap();
    let tool = openai_function_tool(&definition);
    assert_eq!(tool["strict"], true);
    let parameters = &tool["parameters"];
    let required = parameters["required"].as_array().unwrap();
    assert_eq!(
        required.len(),
        parameters["properties"].as_object().unwrap().len()
    );
    assert!(required.iter().any(|field| field == "anchor"));
    assert!(required.iter().any(|field| field == "alt"));

    let anchor_object = parameters["properties"]["anchor"]["anyOf"]
        .as_array()
        .unwrap()
        .iter()
        .find(|schema| schema["type"] == "object")
        .unwrap();
    assert_eq!(anchor_object["additionalProperties"], false);
    assert_eq!(
        anchor_object["required"].as_array().unwrap().len(),
        anchor_object["properties"].as_object().unwrap().len()
    );
}

#[test]
fn subscription_models_follow_the_entitlement_endpoint_catalog() {
    let catalog = model_catalog("chatgpt-subscription").unwrap();
    assert_eq!(catalog.current_model, "gpt-5.6-sol");
    assert!(catalog
        .models
        .iter()
        .any(|model| model.slug == "gpt-5.6-terra"));
    assert_eq!(catalog.models[0].context_window_tokens, 272_000);
    assert!(catalog.models[0]
        .supported_reasoning_levels
        .iter()
        .any(|level| level.effort == "ultra"));
    assert!(catalog.models[0]
        .service_tiers
        .iter()
        .any(|tier| tier.id == "priority"));
    assert!(catalog.models.iter().any(|model| model.slug == "gpt-5.5"));
}

#[test]
fn model_catalog_exposes_context_windows_for_renderer_planning() {
    let anthropic = model_catalog("anthropic-api").unwrap();
    let compatible = model_catalog("openai-compatible").unwrap();
    assert!(anthropic
        .models
        .iter()
        .all(|model| model.context_window_tokens == 200_000));
    assert_eq!(compatible.models[0].context_window_tokens, 64_000);
}

#[test]
fn compatible_models_do_not_claim_reasoning_support() {
    let catalog = model_catalog("openai-compatible").unwrap();
    assert_eq!(catalog.current_reasoning_effort, "");
    assert!(!catalog.models[0].supports_reasoning);
    assert!(catalog.models[0].supported_reasoning_levels.is_empty());
}

#[test]
fn unsupported_transports_never_receive_reasoning_parameters() {
    let mut body = serde_json::json!({ "model": "custom" });
    configure_openai_reasoning(&mut body, false, false, "medium");
    assert!(body.get("reasoning").is_none());

    configure_openai_reasoning(&mut body, true, true, "high");
    assert_eq!(body["reasoning"]["effort"], "high");
    assert_eq!(body["reasoning"]["summary"], "auto");
}

#[test]
fn output_text_joins_only_assistant_text_blocks() {
    let value = serde_json::json!({
        "output": [{
            "type": "message",
            "content": [
                { "type": "output_text", "text": "第一段" },
                { "type": "output_text", "text": "第二段" }
            ]
        }]
    });
    assert_eq!(openai_output_text(&value), "第一段第二段");
}

#[test]
fn parses_openai_function_calls_without_executing_them() {
    let value = serde_json::json!({
        "output": [{
            "type": "function_call",
            "call_id": "call-1",
            "name": "read_markdown",
            "arguments": "{\"path\":\"draft.md\"}"
        }]
    });
    let calls = openai_tool_calls(&value).unwrap();
    assert_eq!(calls[0].name, "read_markdown");
    assert_eq!(calls[0].arguments["path"], "draft.md");
}
