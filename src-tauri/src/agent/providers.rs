//! [INPUT]: 依赖 Provider HTTP/stream/Chat Completions adapter、base64、角色化会话投影、credential、ChatGPT OAuth、受管附件与 runtime 设置
//! [OUTPUT]: 向 Agent Loop 提供 OpenAI/ChatGPT、Anthropic/MiniMax Messages 与其他 Chat-compatible API 的结构化历史、增量文本、Provider 专用工具 schema、思考块和图片适配
//! [POS]: 本地 AI agent 的模型传输层，按厂商最佳协议分离可见正文、推理内容与工具约束，不拥有完整会话、工具政策或作者审阅状态
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use super::assistant_attachments::{AssistantAttachmentKind, ResolvedAssistantAttachment};
use super::chatgpt_auth;
use super::credentials::read_provider_secret;
pub(super) use super::provider_catalog::{model_catalog, normalize_provider};
use super::provider_chat;
use super::provider_conversation::{anthropic_conversation_messages, openai_conversation_messages};
use super::provider_http::{http_client, read_json_response, send_provider_request};
use super::provider_stream::{collect_anthropic_sse, collect_openai_sse, ProviderStreamSink};
use super::tools::{ToolDefinition, ToolEffect};
use crate::models::{AgentConversationMessage, AgentRuntimeSettings, AgentUsage};
use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use serde_json::{json, Value};
use std::fs;

const OPENAI_RESPONSES_URL: &str = "https://api.openai.com/v1/responses";
const CHATGPT_RESPONSES_URL: &str = "https://chatgpt.com/backend-api/codex/responses";
const ANTHROPIC_MESSAGES_URL: &str = "https://api.anthropic.com/v1/messages";

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
    supports_reasoning: bool,
    reasoning_summary: bool,
    allow_priority: bool,
    label: &'a str,
}

struct AnthropicTransport<'a> {
    secret: &'a str,
    endpoint: &'a str,
    fallback_model: &'a str,
    label: &'a str,
    auth: AnthropicAuth,
    adaptive_reasoning: bool,
}

enum AnthropicAuth {
    ApiKey,
    Bearer,
}

pub(super) async fn complete(
    provider: &str,
    system: &str,
    prompt: &str,
    conversation_messages: &[AgentConversationMessage],
    attachments: &[ResolvedAssistantAttachment],
    runtime: &AgentRuntimeSettings,
) -> Result<String, String> {
    let sink: ProviderStreamSink = std::sync::Arc::new(|_| {});
    let turn = complete_turn(
        provider,
        system,
        prompt,
        conversation_messages,
        attachments,
        runtime,
        &[],
        None,
        &[],
        &sink,
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
    conversation_messages: &[AgentConversationMessage],
    attachments: &[ResolvedAssistantAttachment],
    runtime: &AgentRuntimeSettings,
    tools: &[ToolDefinition],
    state: Option<&Value>,
    tool_results: &[ProviderToolResult],
    sink: &ProviderStreamSink,
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
                    streaming: true,
                    supports_reasoning: true,
                    reasoning_summary: true,
                    allow_priority: true,
                    label: "OpenAI",
                },
                system,
                prompt,
                conversation_messages,
                attachments,
                runtime,
                tools,
                state,
                tool_results,
                sink,
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
                    supports_reasoning: false,
                    reasoning_summary: false,
                    allow_priority: false,
                    label: "OpenAI-compatible",
                },
                system,
                prompt,
                conversation_messages,
                attachments,
                runtime,
                tools,
                state,
                tool_results,
                sink,
            )
            .await
        }
        "anthropic-api" => {
            let secret = read_provider_secret(&provider)?;
            complete_anthropic_turn(
                AnthropicTransport {
                    secret: &secret,
                    endpoint: ANTHROPIC_MESSAGES_URL,
                    fallback_model: "claude-sonnet-5",
                    label: "Anthropic",
                    auth: AnthropicAuth::ApiKey,
                    adaptive_reasoning: true,
                },
                system,
                prompt,
                conversation_messages,
                attachments,
                runtime,
                tools,
                state,
                tool_results,
                sink,
            )
            .await
        }
        "minimax-api" => {
            let secret = read_provider_secret(&provider)?;
            complete_anthropic_turn(
                AnthropicTransport {
                    secret: &secret,
                    endpoint: "https://api.minimaxi.com/anthropic/v1/messages",
                    fallback_model: "MiniMax-M2.7",
                    label: "MiniMax",
                    auth: AnthropicAuth::Bearer,
                    adaptive_reasoning: false,
                },
                system,
                prompt,
                conversation_messages,
                attachments,
                runtime,
                tools,
                state,
                tool_results,
                sink,
            )
            .await
        }
        "qwen-api" | "deepseek-api" | "kimi-api" => {
            provider_chat::complete_chat_turn(
                &provider,
                &read_provider_secret(&provider)?,
                system,
                prompt,
                conversation_messages,
                attachments,
                runtime,
                tools,
                state,
                tool_results,
                sink,
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
                    fallback_model: "gpt-5.6-sol",
                    streaming: true,
                    supports_reasoning: true,
                    reasoning_summary: true,
                    allow_priority: true,
                    label: "ChatGPT",
                },
                system,
                prompt,
                conversation_messages,
                attachments,
                runtime,
                tools,
                state,
                tool_results,
                sink,
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
    conversation_messages: &[AgentConversationMessage],
    attachments: &[ResolvedAssistantAttachment],
    runtime: &AgentRuntimeSettings,
    tools: &[ToolDefinition],
    state: Option<&Value>,
    tool_results: &[ProviderToolResult],
    sink: &ProviderStreamSink,
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
        let mut input = openai_conversation_messages(conversation_messages);
        input.push(json!({ "role": "user", "content": content }));
        input
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
        body["tools"] = Value::Array(tools.iter().map(openai_function_tool).collect());
        body["parallel_tool_calls"] = json!(false);
    }
    configure_openai_reasoning(
        &mut body,
        transport.supports_reasoning,
        transport.reasoning_summary,
        &runtime.reasoning_effort,
    );
    configure_output_token_limit(&mut body, runtime.max_output_tokens, "max_output_tokens");
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
        request = request.header("OpenAI-Beta", "responses=experimental");
        request = request.header("originator", originator);
        if let Some(session_id) = &session_id {
            request = request.header("session-id", session_id);
        }
    }
    let response = send_provider_request(request, transport.label)
        .await
        .map_err(|error| error.to_string())?;
    let value = if transport.streaming {
        collect_openai_sse(response, sink).await?
    } else {
        read_json_response(response, transport.label)
            .await
            .map_err(|error| error.to_string())?
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

pub(super) fn openai_function_tool(tool: &ToolDefinition) -> Value {
    let strict = tool.effect == ToolEffect::Proposal;
    json!({
        "type": "function",
        "name": tool.name,
        "description": tool.description,
        "parameters": if strict {
            strict_openai_schema(&tool.input_schema)
        } else {
            tool.input_schema.clone()
        },
        "strict": strict
    })
}

fn strict_openai_schema(schema: &Value) -> Value {
    let mut normalized = schema.clone();
    if schema["type"].as_str() != Some("object") {
        return normalized;
    }
    let Some(properties) = schema["properties"].as_object() else {
        return normalized;
    };
    let originally_required = schema["required"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(Value::as_str)
        .collect::<std::collections::HashSet<_>>();
    let mut strict_properties = serde_json::Map::new();
    for (name, property) in properties {
        let property = strict_openai_schema(property);
        strict_properties.insert(
            name.clone(),
            if originally_required.contains(name.as_str()) {
                property
            } else {
                json!({ "anyOf": [property, { "type": "null" }] })
            },
        );
    }
    normalized["properties"] = Value::Object(strict_properties);
    normalized["required"] = Value::Array(properties.keys().cloned().map(Value::String).collect());
    normalized["additionalProperties"] = json!(false);
    normalized
}

#[allow(clippy::too_many_arguments)]
async fn complete_anthropic_turn(
    transport: AnthropicTransport<'_>,
    system: &str,
    prompt: &str,
    conversation_messages: &[AgentConversationMessage],
    attachments: &[ResolvedAssistantAttachment],
    runtime: &AgentRuntimeSettings,
    tools: &[ToolDefinition],
    state: Option<&Value>,
    tool_results: &[ProviderToolResult],
    sink: &ProviderStreamSink,
) -> Result<ProviderTurn, String> {
    let model = selected_model(runtime, transport.fallback_model)?;
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
        .unwrap_or_else(|| {
            let mut messages = anthropic_conversation_messages(conversation_messages);
            messages.push(json!({ "role": "user", "content": content }));
            messages
        });
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
        "max_tokens": runtime.max_output_tokens.unwrap_or(8192),
        "system": system,
        "messages": messages,
        "stream": true
    });
    if transport.adaptive_reasoning && !runtime.reasoning_effort.trim().is_empty() {
        body["output_config"] = json!({ "effort": runtime.reasoning_effort.trim() });
        body["thinking"] = json!({ "type": "adaptive" });
    }
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
    let request = http_client()?
        .post(transport.endpoint)
        .header("anthropic-version", "2023-06-01")
        .json(&body);
    let request = match transport.auth {
        AnthropicAuth::ApiKey => request.header("x-api-key", transport.secret),
        AnthropicAuth::Bearer => request.bearer_auth(transport.secret),
    };
    let response = send_provider_request(request, transport.label)
        .await
        .map_err(|error| error.to_string())?;
    let value = collect_anthropic_sse(response, transport.label, sink).await?;
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
        return Err(format!(
            "{} 已完成请求，但没有返回可见文字。",
            transport.label
        ));
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

pub(super) fn configure_output_token_limit(
    body: &mut Value,
    max_output_tokens: Option<u32>,
    field: &str,
) {
    if let Some(max_output_tokens) = max_output_tokens.filter(|value| *value > 0) {
        body[field] = json!(max_output_tokens);
    }
}

pub(super) fn configure_openai_reasoning(
    body: &mut Value,
    supports_reasoning: bool,
    reasoning_summary: bool,
    effort: &str,
) {
    let effort = effort.trim();
    if !supports_reasoning || effort.is_empty() {
        return;
    }
    body["reasoning"] = if reasoning_summary {
        json!({ "effort": effort, "summary": "auto" })
    } else {
        json!({ "effort": effort })
    };
}

pub(super) fn selected_model<'a>(
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

pub(super) fn normalize_compatible_url(value: &str) -> Result<String, String> {
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

pub(super) fn encoded_image(
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

pub(super) fn readable_text_attachment(
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

pub(super) fn openai_output_text(value: &Value) -> String {
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

pub(super) fn openai_tool_calls(value: &Value) -> Result<Vec<ProviderToolCall>, String> {
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
