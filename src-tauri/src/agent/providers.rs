//! [INPUT]: 依赖 reqwest、base64、Provider credential store、ChatGPT OAuth、附件边界与 Agent runtime 设置
//! [OUTPUT]: 向 Agent Loop 提供 Provider 归一化、模型目录和 OpenAI/ChatGPT/Anthropic 文本与图片请求适配
//! [POS]: 本地 AI agent 领域的模型传输层，只翻译厂商协议，不拥有会话、工具政策或作者审阅状态
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use super::assistant_attachments::{AssistantAttachmentKind, ResolvedAssistantAttachment};
use super::chatgpt_auth;
use super::credentials::read_provider_secret;
use super::tools::ToolDefinition;
use crate::models::{
    AgentModelCatalog, AgentModelOption, AgentReasoningLevel, AgentRuntimeSettings,
    AgentServiceTier, AgentUsage,
};
use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use serde_json::{json, Value};
use std::fs;
use std::time::Duration;

const OPENAI_RESPONSES_URL: &str = "https://api.openai.com/v1/responses";
const CHATGPT_RESPONSES_URL: &str = "https://chatgpt.com/backend-api/codex/responses";
const ANTHROPIC_MESSAGES_URL: &str = "https://api.anthropic.com/v1/messages";
const REQUEST_TIMEOUT: Duration = Duration::from_secs(180);

#[derive(Debug, Clone)]
pub(super) struct ProviderToolCall {
    pub(super) id: String,
    pub(super) name: String,
    pub(super) arguments: Value,
}

#[derive(Debug, Clone)]
pub(super) struct ProviderToolResult {
    pub(super) call_id: String,
    pub(super) output: String,
}

#[derive(Debug)]
pub(super) struct ProviderTurn {
    pub(super) text: String,
    pub(super) usage: AgentUsage,
    pub(super) tool_calls: Vec<ProviderToolCall>,
    pub(super) state: Value,
}

struct OpenAiTransport<'a> {
    secret: &'a str,
    endpoint: &'a str,
    account_id: Option<&'a str>,
    originator: Option<&'a str>,
    fallback_model: &'a str,
    streaming: bool,
    allow_priority: bool,
    label: &'a str,
}

pub(super) fn normalize_provider(value: &str) -> Result<String, String> {
    let normalized = value.trim().to_ascii_lowercase();
    match normalized.as_str() {
        "openai-api" | "anthropic-api" | "openai-compatible" | "chatgpt-subscription" => {
            Ok(normalized)
        }
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
            ),
            model("gpt-5.6-sol", "GPT-5.6 Sol", "复杂专业任务", true),
            model("gpt-5.6-luna", "GPT-5.6 Luna", "高频、成本敏感任务", true),
        ],
        "chatgpt-subscription" => vec![
            model("gpt-5.5", "GPT-5.5", "ChatGPT 订阅通用高质量模型", false),
            model("gpt-5.4", "GPT-5.4", "ChatGPT 订阅稳定模型", false),
            model(
                "gpt-5.4-mini",
                "GPT-5.4 Mini",
                "ChatGPT 订阅低延迟模型",
                false,
            ),
            model(
                "gpt-5.3-codex-spark",
                "GPT-5.3 Codex Spark",
                "ChatGPT 订阅快速工具调用模型",
                false,
            ),
        ],
        "anthropic-api" => vec![
            model(
                "claude-sonnet-5",
                "Claude Sonnet 5",
                "Anthropic Messages API 通用写作模型",
                false,
            ),
            model(
                "claude-opus-5",
                "Claude Opus 5",
                "Anthropic Messages API 高质量模型",
                false,
            ),
            model(
                "claude-haiku-4-5-20251001",
                "Claude Haiku 4.5",
                "Anthropic Messages API 低延迟模型",
                false,
            ),
        ],
        "openai-compatible" => vec![model(
            "custom",
            "自定义模型",
            "由兼容服务的 model 设置决定",
            false,
        )],
        _ => unreachable!("provider was normalized"),
    };
    Ok(AgentModelCatalog {
        fetched_at: String::new(),
        current_model: models
            .first()
            .map(|model| model.slug.clone())
            .unwrap_or_default(),
        current_reasoning_effort: "medium".to_string(),
        models,
    })
}

pub(super) async fn complete(
    provider: &str,
    system: &str,
    prompt: &str,
    attachments: &[ResolvedAssistantAttachment],
    runtime: &AgentRuntimeSettings,
) -> Result<String, String> {
    let turn = complete_turn(
        provider,
        system,
        prompt,
        attachments,
        runtime,
        &[],
        None,
        &[],
    )
    .await?;
    if !turn.tool_calls.is_empty() {
        return Err("Provider 在未提供工具时返回了工具调用。".to_string());
    }
    Ok(turn.text)
}

#[allow(clippy::too_many_arguments)]
pub(super) async fn complete_turn(
    provider: &str,
    system: &str,
    prompt: &str,
    attachments: &[ResolvedAssistantAttachment],
    runtime: &AgentRuntimeSettings,
    tools: &[ToolDefinition],
    state: Option<&Value>,
    tool_results: &[ProviderToolResult],
) -> Result<ProviderTurn, String> {
    let provider = normalize_provider(provider)?;
    match provider.as_str() {
        "openai-api" => {
            let secret = read_provider_secret(&provider)?;
            complete_openai_turn(
                OpenAiTransport {
                    secret: &secret,
                    endpoint: OPENAI_RESPONSES_URL,
                    account_id: None,
                    originator: None,
                    fallback_model: "gpt-5.6-terra",
                    streaming: false,
                    allow_priority: true,
                    label: "OpenAI",
                },
                system,
                prompt,
                attachments,
                runtime,
                tools,
                state,
                tool_results,
            )
            .await
        }
        "openai-compatible" => {
            let base_url = normalize_compatible_url(&runtime.base_url)?;
            let endpoint = format!("{base_url}/responses");
            let secret = read_provider_secret(&provider)?;
            complete_openai_turn(
                OpenAiTransport {
                    secret: &secret,
                    endpoint: &endpoint,
                    account_id: None,
                    originator: None,
                    fallback_model: "custom",
                    streaming: false,
                    allow_priority: true,
                    label: "OpenAI-compatible",
                },
                system,
                prompt,
                attachments,
                runtime,
                tools,
                state,
                tool_results,
            )
            .await
        }
        "anthropic-api" => {
            complete_anthropic_turn(
                &read_provider_secret(&provider)?,
                system,
                prompt,
                attachments,
                runtime,
                tools,
                state,
                tool_results,
            )
            .await
        }
        "chatgpt-subscription" => {
            let access = chatgpt_auth::access().await?;
            complete_openai_turn(
                OpenAiTransport {
                    secret: &access.token,
                    endpoint: CHATGPT_RESPONSES_URL,
                    account_id: Some(&access.account_id),
                    originator: Some("loby"),
                    fallback_model: "gpt-5.5",
                    streaming: true,
                    allow_priority: false,
                    label: "ChatGPT",
                },
                system,
                prompt,
                attachments,
                runtime,
                tools,
                state,
                tool_results,
            )
            .await
        }
        _ => unreachable!("provider was normalized"),
    }
}

#[allow(clippy::too_many_arguments)]
async fn complete_openai_turn(
    transport: OpenAiTransport<'_>,
    system: &str,
    prompt: &str,
    attachments: &[ResolvedAssistantAttachment],
    runtime: &AgentRuntimeSettings,
    tools: &[ToolDefinition],
    state: Option<&Value>,
    tool_results: &[ProviderToolResult],
) -> Result<ProviderTurn, String> {
    let model = selected_model(runtime, transport.fallback_model)?;
    let mut content = vec![json!({ "type": "input_text", "text": prompt })];
    for attachment in attachments {
        match attachment.kind {
            AssistantAttachmentKind::Image => {
                let (mime, data) = encoded_image(attachment)?;
                content.push(json!({
                    "type": "input_image",
                    "image_url": format!("data:{mime};base64,{data}")
                }));
            }
            AssistantAttachmentKind::Document => {
                if let Some(text) = readable_text_attachment(attachment)? {
                    content.push(json!({
                        "type": "input_text",
                        "text": format!("\n\n附件 {}：\n{}", attachment.name, text)
                    }));
                }
            }
        }
    }
    let input = if let Some(previous_items) = state.and_then(|value| value["input"].as_array()) {
        let mut next_input = previous_items.clone();
        next_input.extend(
            tool_results
                .iter()
                .map(|result| {
                    json!({
                        "type": "function_call_output",
                        "call_id": result.call_id,
                        "output": result.output
                    })
                })
                .collect::<Vec<_>>(),
        );
        next_input
    } else {
        vec![json!({ "role": "user", "content": content })]
    };
    let mut body = json!({
        "model": model,
        "instructions": system,
        "input": input.clone(),
        "store": false
    });
    if transport.streaming {
        body["stream"] = json!(true);
    }
    if !tools.is_empty() {
        body["tools"] = Value::Array(
            tools
                .iter()
                .map(|tool| {
                    json!({
                        "type": "function",
                        "name": tool.name,
                        "description": tool.description,
                        "parameters": tool.input_schema,
                        "strict": false
                    })
                })
                .collect(),
        );
    }
    if !runtime.reasoning_effort.trim().is_empty() {
        body["reasoning"] = json!({ "effort": runtime.reasoning_effort.trim() });
    }
    if runtime.quick_mode && transport.allow_priority {
        body["service_tier"] = json!("priority");
    }
    let session_id = transport.originator.map(|_| {
        state
            .and_then(|value| value["sessionId"].as_str())
            .map(str::to_string)
            .unwrap_or_else(|| uuid::Uuid::new_v4().to_string())
    });
    let mut request = http_client()?
        .post(transport.endpoint)
        .bearer_auth(transport.secret)
        .json(&body);
    if let Some(account_id) = transport.account_id {
        request = request.header("ChatGPT-Account-Id", account_id);
    }
    if let Some(originator) = transport.originator {
        request = request.header("originator", originator);
        if let Some(session_id) = &session_id {
            request = request.header("session-id", session_id);
        }
    }
    let response = request
        .send()
        .await
        .map_err(|error| network_error(transport.label, error))?;
    let status = response.status();
    let payload = response
        .text()
        .await
        .map_err(|error| format!("{} 返回了无法读取的响应：{error}", transport.label))?;
    if !status.is_success() {
        let value = serde_json::from_str::<Value>(&payload).unwrap_or(Value::Null);
        return Err(provider_api_error(transport.label, status.as_u16(), &value));
    }
    let value = if transport.streaming {
        parse_openai_sse(&payload)?
    } else {
        serde_json::from_str::<Value>(&payload)
            .map_err(|error| format!("{} 返回了无法解析的响应：{error}", transport.label))?
    };
    let text = openai_output_text(&value);
    let tool_calls = openai_tool_calls(&value)?;
    if text.trim().is_empty() && tool_calls.is_empty() {
        return Err(format!(
            "{} 已完成请求，但没有返回可见文字。",
            transport.label
        ));
    }
    let mut next_state = json!({
        "input": input.into_iter()
            .chain(value["output"].as_array().cloned().unwrap_or_default())
            .collect::<Vec<_>>()
    });
    if let Some(session_id) = session_id {
        next_state["sessionId"] = json!(session_id);
    }
    Ok(ProviderTurn {
        text,
        usage: AgentUsage {
            input_tokens: value["usage"]["input_tokens"].as_u64().unwrap_or_default(),
            cached_input_tokens: value["usage"]["input_tokens_details"]["cached_tokens"]
                .as_u64()
                .unwrap_or_default(),
            output_tokens: value["usage"]["output_tokens"].as_u64().unwrap_or_default(),
            reasoning_output_tokens: value["usage"]["output_tokens_details"]["reasoning_tokens"]
                .as_u64()
                .unwrap_or_default(),
        },
        tool_calls,
        state: next_state,
    })
}

#[allow(clippy::too_many_arguments)]
async fn complete_anthropic_turn(
    secret: &str,
    system: &str,
    prompt: &str,
    attachments: &[ResolvedAssistantAttachment],
    runtime: &AgentRuntimeSettings,
    tools: &[ToolDefinition],
    state: Option<&Value>,
    tool_results: &[ProviderToolResult],
) -> Result<ProviderTurn, String> {
    let model = selected_model(runtime, "claude-sonnet-5")?;
    let mut content = Vec::new();
    for attachment in attachments {
        match attachment.kind {
            AssistantAttachmentKind::Image => {
                let (media_type, data) = encoded_image(attachment)?;
                content.push(json!({
                    "type": "image",
                    "source": { "type": "base64", "media_type": media_type, "data": data }
                }));
            }
            AssistantAttachmentKind::Document => {
                if let Some(text) = readable_text_attachment(attachment)? {
                    content.push(json!({
                        "type": "text",
                        "text": format!("附件 {}：\n{}", attachment.name, text)
                    }));
                }
            }
        }
    }
    content.push(json!({ "type": "text", "text": prompt }));
    let mut messages = state
        .and_then(|state| state["messages"].as_array())
        .cloned()
        .unwrap_or_else(|| vec![json!({ "role": "user", "content": content })]);
    if !tool_results.is_empty() {
        messages.push(json!({
            "role": "user",
            "content": tool_results.iter().map(|result| json!({
                "type": "tool_result",
                "tool_use_id": result.call_id,
                "content": result.output
            })).collect::<Vec<_>>()
        }));
    }
    let mut body = json!({
        "model": model,
        "max_tokens": 8192,
        "system": system,
        "messages": messages
    });
    if !tools.is_empty() {
        body["tools"] = Value::Array(
            tools
                .iter()
                .map(|tool| {
                    json!({
                        "name": tool.name,
                        "description": tool.description,
                        "input_schema": tool.input_schema
                    })
                })
                .collect(),
        );
    }
    let response = http_client()?
        .post(ANTHROPIC_MESSAGES_URL)
        .header("x-api-key", secret)
        .header("anthropic-version", "2023-06-01")
        .json(&body)
        .send()
        .await
        .map_err(|error| network_error("Anthropic", error))?;
    let status = response.status();
    let value = response
        .json::<Value>()
        .await
        .map_err(|error| format!("Anthropic 返回了无法解析的响应：{error}"))?;
    if !status.is_success() {
        return Err(provider_api_error("Anthropic", status.as_u16(), &value));
    }
    let text = value["content"]
        .as_array()
        .into_iter()
        .flatten()
        .filter(|block| block["type"].as_str() == Some("text"))
        .filter_map(|block| block["text"].as_str())
        .collect::<Vec<_>>()
        .join("");
    let tool_calls = anthropic_tool_calls(&value)?;
    if text.trim().is_empty() && tool_calls.is_empty() {
        return Err("Anthropic 已完成请求，但没有返回可见文字。".to_string());
    }
    let mut next_messages = body["messages"].as_array().cloned().unwrap_or_default();
    next_messages.push(json!({ "role": "assistant", "content": value["content"] }));
    Ok(ProviderTurn {
        text,
        usage: AgentUsage {
            input_tokens: value["usage"]["input_tokens"].as_u64().unwrap_or_default(),
            cached_input_tokens: value["usage"]["cache_read_input_tokens"]
                .as_u64()
                .unwrap_or_default(),
            output_tokens: value["usage"]["output_tokens"].as_u64().unwrap_or_default(),
            reasoning_output_tokens: 0,
        },
        tool_calls,
        state: json!({ "messages": next_messages }),
    })
}

fn model(slug: &str, display_name: &str, description: &str, quick_mode: bool) -> AgentModelOption {
    AgentModelOption {
        slug: slug.to_string(),
        display_name: display_name.to_string(),
        description: description.to_string(),
        default_reasoning_level: "medium".to_string(),
        supported_reasoning_levels: ["low", "medium", "high"]
            .into_iter()
            .map(|effort| AgentReasoningLevel {
                effort: effort.to_string(),
                description: effort.to_string(),
            })
            .collect(),
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

fn selected_model<'a>(
    runtime: &'a AgentRuntimeSettings,
    fallback: &'a str,
) -> Result<&'a str, String> {
    let model = runtime.model.trim();
    let model = if model.is_empty() || model == "auto" {
        fallback
    } else {
        model
    };
    if model.len() > 128
        || !model.chars().all(|character| {
            character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.' | ':' | '/')
        })
    {
        return Err("模型标识格式无效。".to_string());
    }
    Ok(model)
}

fn normalize_compatible_url(value: &str) -> Result<String, String> {
    let value = value.trim().trim_end_matches('/');
    if value.is_empty() {
        return Err("请先配置 OpenAI-compatible API Base URL。".to_string());
    }
    let parsed = reqwest::Url::parse(value).map_err(|_| "API Base URL 无效。".to_string())?;
    if parsed.scheme() != "https" && !(cfg!(debug_assertions) && parsed.scheme() == "http") {
        return Err("API Base URL 必须使用 HTTPS。".to_string());
    }
    Ok(if value.ends_with("/v1") {
        value.to_string()
    } else {
        format!("{value}/v1")
    })
}

fn encoded_image(
    attachment: &ResolvedAssistantAttachment,
) -> Result<(&'static str, String), String> {
    let mime = match attachment
        .path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase()
        .as_str()
    {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "gif" => "image/gif",
        _ => return Err("不支持的图片附件格式。".to_string()),
    };
    let bytes = fs::read(&attachment.path).map_err(|error| error.to_string())?;
    Ok((mime, BASE64_STANDARD.encode(bytes)))
}

fn readable_text_attachment(
    attachment: &ResolvedAssistantAttachment,
) -> Result<Option<String>, String> {
    let extension = attachment
        .path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    if !matches!(extension.as_str(), "txt" | "md" | "csv" | "json") {
        return Err(format!(
            "当前 Provider 暂不能直接读取 {}，请转换为 Markdown、TXT、CSV 或 JSON。",
            attachment.name
        ));
    }
    let text = fs::read_to_string(&attachment.path).map_err(|error| error.to_string())?;
    Ok(Some(text))
}

fn openai_output_text(value: &Value) -> String {
    value["output"]
        .as_array()
        .into_iter()
        .flatten()
        .filter(|item| item["type"].as_str() == Some("message"))
        .filter_map(|item| item["content"].as_array())
        .flatten()
        .filter(|content| content["type"].as_str() == Some("output_text"))
        .filter_map(|content| content["text"].as_str())
        .collect::<Vec<_>>()
        .join("")
}

fn parse_openai_sse(payload: &str) -> Result<Value, String> {
    let normalized = payload.replace("\r\n", "\n");
    let mut completed: Option<Value> = None;
    let mut output_items = Vec::new();
    let mut text_deltas = String::new();
    for block in normalized.split("\n\n") {
        let data = block
            .lines()
            .filter_map(|line| line.strip_prefix("data:").map(str::trim_start))
            .collect::<Vec<_>>()
            .join("\n");
        if data.is_empty() || data == "[DONE]" {
            continue;
        }
        let event: Value = serde_json::from_str(&data)
            .map_err(|_| "ChatGPT 返回了无法解析的流式事件。".to_string())?;
        match event["type"].as_str() {
            Some("response.completed") => completed = Some(event["response"].clone()),
            Some("response.output_item.done") => {
                if !event["item"].is_null() {
                    output_items.push(event["item"].clone());
                }
            }
            Some("response.output_text.delta") => {
                if let Some(delta) = event["delta"].as_str() {
                    text_deltas.push_str(delta);
                }
            }
            Some("response.failed") => {
                return Err(provider_api_error("ChatGPT", 200, &event["response"]));
            }
            Some("error") => return Err(provider_api_error("ChatGPT", 200, &event)),
            _ => {}
        }
    }
    let mut response = completed.unwrap_or_else(|| json!({}));
    let response_has_output = response["output"]
        .as_array()
        .is_some_and(|output| !output.is_empty());
    if !response_has_output && !output_items.is_empty() {
        response["output"] = Value::Array(output_items);
    } else if !response_has_output && !text_deltas.is_empty() {
        response["output"] = json!([{
            "type": "message",
            "role": "assistant",
            "content": [{ "type": "output_text", "text": text_deltas }]
        }]);
    }
    if response["output"].as_array().is_none() {
        return Err("ChatGPT 已结束流式响应，但没有返回完成事件。".to_string());
    }
    Ok(response)
}

fn openai_tool_calls(value: &Value) -> Result<Vec<ProviderToolCall>, String> {
    value["output"]
        .as_array()
        .into_iter()
        .flatten()
        .filter(|item| item["type"].as_str() == Some("function_call"))
        .map(|item| {
            let arguments = item["arguments"]
                .as_str()
                .ok_or_else(|| "OpenAI 工具参数缺失。".to_string())?;
            Ok(ProviderToolCall {
                id: item["call_id"].as_str().unwrap_or_default().to_string(),
                name: item["name"].as_str().unwrap_or_default().to_string(),
                arguments: serde_json::from_str(arguments)
                    .map_err(|_| "OpenAI 返回了无效工具参数。".to_string())?,
            })
        })
        .collect()
}

fn anthropic_tool_calls(value: &Value) -> Result<Vec<ProviderToolCall>, String> {
    value["content"]
        .as_array()
        .into_iter()
        .flatten()
        .filter(|item| item["type"].as_str() == Some("tool_use"))
        .map(|item| {
            Ok(ProviderToolCall {
                id: item["id"].as_str().unwrap_or_default().to_string(),
                name: item["name"].as_str().unwrap_or_default().to_string(),
                arguments: item["input"].clone(),
            })
        })
        .collect()
}

fn http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(REQUEST_TIMEOUT)
        .user_agent("Loby/0.1")
        .build()
        .map_err(|error| error.to_string())
}

fn network_error(provider: &str, error: reqwest::Error) -> String {
    if error.is_timeout() {
        format!("{provider} 请求超时，请稍后重试。")
    } else {
        format!("无法连接 {provider}：{error}")
    }
}

fn provider_api_error(provider: &str, status: u16, value: &Value) -> String {
    let message = value["error"]["message"]
        .as_str()
        .or_else(|| value["message"].as_str())
        .unwrap_or("服务返回错误");
    let message = message.chars().take(500).collect::<String>();
    format!("{provider} 请求失败（HTTP {status}）：{message}")
}

#[cfg(test)]
mod tests {
    use super::{
        model_catalog, normalize_compatible_url, normalize_provider, openai_output_text,
        openai_tool_calls, parse_openai_sse,
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

    #[test]
    fn parses_chatgpt_sse_without_codex_runtime() {
        let value = parse_openai_sse(
            "data: {\"type\":\"response.output_item.done\",\"item\":{\"type\":\"message\",\"content\":[{\"type\":\"output_text\",\"text\":\"完成\"}]}}\n\ndata: {\"type\":\"response.completed\",\"response\":{\"output\":null,\"usage\":{\"input_tokens\":12,\"output_tokens\":2}}}\n\ndata: [DONE]\n\n",
        )
        .unwrap();
        assert_eq!(openai_output_text(&value), "完成");
        assert_eq!(value["usage"]["input_tokens"], 12);
    }
}
