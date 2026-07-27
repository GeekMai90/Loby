//! [INPUT]: 依赖 agent::providers 的 Provider 归一化、目录与响应解析测试接口
//! [OUTPUT]: 提供 Provider adapter 的隔离回归测试，不进入生产构建
//! [POS]: Loby Agent 原生测试模块，避免传输实现因内联测试越过单文件职责边界
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use super::providers::{
    model_catalog, normalize_compatible_url, normalize_provider, openai_output_text,
    openai_tool_calls,
};

#[test]
fn provider_names_are_closed_over_known_adapters() {
    assert_eq!(normalize_provider(" OpenAI-API ").unwrap(), "openai-api");
    assert!(normalize_provider("unknown-provider").is_err());
    assert!(normalize_provider("claude").is_err());
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
fn subscription_models_follow_the_entitlement_endpoint_catalog() {
    let catalog = model_catalog("chatgpt-subscription").unwrap();
    assert_eq!(catalog.current_model, "gpt-5.5");
    assert!(catalog.models.iter().any(|model| model.slug == "gpt-5.4"));
    assert!(!catalog
        .models
        .iter()
        .any(|model| model.slug == "gpt-5.6-terra"));
    assert!(catalog
        .models
        .iter()
        .all(|model| model.context_window_tokens == 128_000));
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
