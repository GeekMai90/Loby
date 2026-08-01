//! [INPUT]: 依赖 Provider HTTP/stream、OpenAI 角色投影、凭证后的固定服务配置、附件编码、工具定义与运行设置
//! [OUTPUT]: 向 providers 提供千问、DeepSeek、Kimi 的 OpenAI Chat Completions 轮次适配
//! [POS]: 本地 AI agent 的 Chat Completions 协议边界，隔离固定服务 Endpoint、推理参数、工具续轮与厂商响应状态
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md

use super::assistant_attachments::{AssistantAttachmentKind, ResolvedAssistantAttachment};
use super::provider_conversation::openai_conversation_messages;
use super::provider_http::{http_client, send_provider_request};
use super::provider_stream::{collect_chat_completions_sse, ProviderStreamSink};
use super::providers::{
    configure_output_token_limit, encoded_image, readable_text_attachment, selected_model,
    ProviderToolCall, ProviderToolResult, ProviderTurn,
};
use super::tools::ToolDefinition;
use crate::models::{AgentConversationMessage, AgentRuntimeSettings, AgentUsage};
use serde_json::{json, Value};

struct ChatTransport {
    endpoint: &'static str,
    fallback_model: &'static str,
    label: &'static str,
    reasoning: ChatReasoning,
}

enum ChatReasoning {
    QwenBudget,
    DeepSeekEffort,
    KimiToggle,
}

#[allow(clippy::too_many_arguments)]
pub(super) async fn complete_chat_turn(
    provider: &str,
    secret: &str,
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
    let transport = chat_transport(provider)?;
    let model = selected_model(runtime, transport.fallback_model)?;
    let mut messages = state
        .and_then(|value| value["messages"].as_array())
        .cloned()
        .unwrap_or_else(|| initial_messages(system, prompt, conversation_messages));
    if state.is_none() {
        append_attachments(&mut messages, attachments)?;
    }
    messages.extend(tool_results.iter().map(|result| {
        json!({
            "role": "tool",
            "tool_call_id": result.call_id,
            "content": result.output
        })
    }));

    let mut body = json!({
        "model": model,
        "messages": messages,
        "stream": true
    });
    configure_output_token_limit(&mut body, runtime.max_output_tokens, "max_tokens");
    configure_reasoning(&mut body, &transport.reasoning, &runtime.reasoning_effort);
    if !tools.is_empty() {
        body["tools"] = Value::Array(
            tools
                .iter()
                .map(|tool| {
                    json!({
                        "type": "function",
                        "function": {
                            "name": tool.name,
                            "description": tool.description,
                            "parameters": tool.input_schema
                        }
                    })
                })
                .collect(),
        );
    }

    let response = send_provider_request(
        http_client()?
            .post(transport.endpoint)
            .bearer_auth(secret)
            .json(&body),
        transport.label,
    )
    .await
    .map_err(|error| error.to_string())?;
    let value = collect_chat_completions_sse(response, transport.label, sink).await?;
    let message = value["choices"][0]["message"].clone();
    let text = message["content"].as_str().unwrap_or_default().to_string();
    let tool_calls = chat_tool_calls(&message)?;
    if text.trim().is_empty() && tool_calls.is_empty() {
        return Err(format!(
            "{} 已完成请求，但没有返回可见文字。",
            transport.label
        ));
    }
    let mut next_messages = body["messages"].as_array().cloned().unwrap_or_default();
    next_messages.push(message);
    Ok(ProviderTurn {
        text,
        usage: AgentUsage {
            input_tokens: value["usage"]["prompt_tokens"].as_u64().unwrap_or_default(),
            cached_input_tokens: value["usage"]["prompt_tokens_details"]["cached_tokens"]
                .as_u64()
                .unwrap_or_default(),
            output_tokens: value["usage"]["completion_tokens"]
                .as_u64()
                .unwrap_or_default(),
            reasoning_output_tokens: value["usage"]["completion_tokens_details"]
                ["reasoning_tokens"]
                .as_u64()
                .unwrap_or_default(),
        },
        tool_calls,
        state: json!({ "messages": next_messages }),
    })
}

fn chat_transport(provider: &str) -> Result<ChatTransport, String> {
    match provider {
        "qwen-api" => Ok(ChatTransport {
            endpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
            fallback_model: "qwen3.7-plus",
            label: "千问",
            reasoning: ChatReasoning::QwenBudget,
        }),
        "deepseek-api" => Ok(ChatTransport {
            endpoint: "https://api.deepseek.com/chat/completions",
            fallback_model: "deepseek-v4-flash",
            label: "DeepSeek",
            reasoning: ChatReasoning::DeepSeekEffort,
        }),
        "kimi-api" => Ok(ChatTransport {
            endpoint: "https://api.moonshot.cn/v1/chat/completions",
            fallback_model: "kimi-k2.6",
            label: "Kimi",
            reasoning: ChatReasoning::KimiToggle,
        }),
        _ => Err("不支持该 Chat Completions Provider。".to_string()),
    }
}

fn initial_messages(
    system: &str,
    prompt: &str,
    conversation_messages: &[AgentConversationMessage],
) -> Vec<Value> {
    let mut messages = vec![json!({ "role": "system", "content": system })];
    messages.extend(openai_conversation_messages(conversation_messages));
    messages.push(json!({ "role": "user", "content": prompt }));
    messages
}

fn append_attachments(
    messages: &mut [Value],
    attachments: &[ResolvedAssistantAttachment],
) -> Result<(), String> {
    if attachments.is_empty() {
        return Ok(());
    }
    let Some(user_message) = messages.last_mut() else {
        return Err("Provider 请求缺少用户消息。".to_string());
    };
    let prompt = user_message["content"].as_str().unwrap_or_default();
    let mut content = vec![json!({ "type": "text", "text": prompt })];
    for attachment in attachments {
        match attachment.kind {
            AssistantAttachmentKind::Image => {
                let (mime, data) = encoded_image(attachment)?;
                content.push(json!({
                    "type": "image_url",
                    "image_url": { "url": format!("data:{mime};base64,{data}") }
                }));
            }
            AssistantAttachmentKind::Document => {
                if let Some(text) = readable_text_attachment(attachment)? {
                    content.push(json!({
                        "type": "text",
                        "text": format!("\n\n附件 {}：\n{}", attachment.name, text)
                    }));
                }
            }
        }
    }
    user_message["content"] = Value::Array(content);
    Ok(())
}

fn configure_reasoning(body: &mut Value, reasoning: &ChatReasoning, effort: &str) {
    let effort = effort.trim();
    match reasoning {
        ChatReasoning::QwenBudget if !effort.is_empty() => {
            body["enable_thinking"] = json!(true);
            body["thinking_budget"] = json!(match effort {
                "low" => 4_096,
                "medium" => 16_384,
                _ => 32_768,
            });
        }
        ChatReasoning::DeepSeekEffort if !effort.is_empty() => {
            body["thinking"] = json!({ "type": "enabled" });
            body["reasoning_effort"] = json!(if matches!(effort, "max" | "xhigh") {
                "max"
            } else {
                "high"
            });
        }
        ChatReasoning::KimiToggle if !effort.is_empty() => {
            body["thinking"] = json!({
                "type": if effort == "disabled" { "disabled" } else { "enabled" }
            });
        }
        _ => {}
    }
}

fn chat_tool_calls(message: &Value) -> Result<Vec<ProviderToolCall>, String> {
    message["tool_calls"]
        .as_array()
        .into_iter()
        .flatten()
        .map(|item| {
            let arguments = item["function"]["arguments"]
                .as_str()
                .ok_or_else(|| "Provider 工具参数缺失。".to_string())?;
            Ok(ProviderToolCall {
                id: item["id"].as_str().unwrap_or_default().to_string(),
                name: item["function"]["name"]
                    .as_str()
                    .unwrap_or_default()
                    .to_string(),
                arguments: serde_json::from_str(arguments)
                    .map_err(|_| "Provider 返回了无效工具参数。".to_string())?,
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::{configure_reasoning, ChatReasoning};
    use serde_json::json;

    #[test]
    fn reasoning_parameters_follow_provider_contracts() {
        let mut qwen = json!({});
        configure_reasoning(&mut qwen, &ChatReasoning::QwenBudget, "medium");
        assert_eq!(qwen["thinking_budget"], 16_384);

        let mut deepseek = json!({});
        configure_reasoning(&mut deepseek, &ChatReasoning::DeepSeekEffort, "max");
        assert_eq!(deepseek["reasoning_effort"], "max");

        let mut kimi = json!({});
        configure_reasoning(&mut kimi, &ChatReasoning::KimiToggle, "disabled");
        assert_eq!(kimi["thinking"]["type"], "disabled");
    }
}
