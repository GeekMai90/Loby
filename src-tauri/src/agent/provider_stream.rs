//! [INPUT]: 依赖 reqwest 流式响应、tokio 空闲超时、serde_json 与 Provider 归一化事件接收器
//! [OUTPUT]: 向 Provider 适配层提供带逐块空闲检测的 SSE 增量解码、OpenAI Responses 与 Anthropic Messages 完整响应聚合
//! [POS]: 本地 AI agent 的流协议边界；逐块发布可见文本和摘要，同时重建可继续 tool loop 的厂商响应
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

const MAX_SSE_BUFFER_BYTES: usize = 16 * 1024 * 1024;
const STREAM_IDLE_TIMEOUT: Duration = Duration::from_secs(180);

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) enum ProviderStreamEvent {
    ResponseStarted,
    TextDelta(String),
    ReasoningSummary(String),
    ToolInputStarted { call_id: String, name: String },
}

pub(super) type ProviderStreamSink = Arc<dyn Fn(ProviderStreamEvent) + Send + Sync>;

pub(super) async fn collect_openai_sse(
    mut response: reqwest::Response,
    sink: &ProviderStreamSink,
) -> Result<Value, String> {
    let mut decoder = SseDecoder::default();
    let mut accumulator = OpenAiAccumulator::default();
    while let Some(chunk) = next_chunk(&mut response, "OpenAI").await? {
        for event in decoder.push(&chunk)? {
            accumulator.accept(event, sink)?;
        }
    }
    for event in decoder.finish()? {
        accumulator.accept(event, sink)?;
    }
    accumulator.finish()
}

pub(super) async fn collect_anthropic_sse(
    mut response: reqwest::Response,
    sink: &ProviderStreamSink,
) -> Result<Value, String> {
    let mut decoder = SseDecoder::default();
    let mut accumulator = AnthropicAccumulator::default();
    while let Some(chunk) = next_chunk(&mut response, "Anthropic").await? {
        for event in decoder.push(&chunk)? {
            accumulator.accept(event, sink)?;
        }
    }
    for event in decoder.finish()? {
        accumulator.accept(event, sink)?;
    }
    accumulator.finish()
}

async fn next_chunk(
    response: &mut reqwest::Response,
    provider: &str,
) -> Result<Option<Vec<u8>>, String> {
    match tokio::time::timeout(STREAM_IDLE_TIMEOUT, response.chunk()).await {
        Err(_) => Err(format!(
            "{provider} 流式响应超过 {} 秒没有新数据，已停止等待；为避免重复内容和计费，落笔不会自动重放已经开始的请求。",
            STREAM_IDLE_TIMEOUT.as_secs()
        )),
        Ok(Err(error)) => Err(format!("{provider} 流式响应读取失败：{error}")),
        Ok(Ok(chunk)) => Ok(chunk.map(|bytes| bytes.to_vec())),
    }
}

#[derive(Default)]
struct SseDecoder {
    buffer: Vec<u8>,
}

impl SseDecoder {
    fn push(&mut self, chunk: &[u8]) -> Result<Vec<Value>, String> {
        self.buffer.extend_from_slice(chunk);
        if self.buffer.len() > MAX_SSE_BUFFER_BYTES {
            return Err("Provider 单个流式事件超过 16 MB，已停止读取。".to_string());
        }
        self.drain(false)
    }

    fn finish(&mut self) -> Result<Vec<Value>, String> {
        self.drain(true)
    }

    fn drain(&mut self, finishing: bool) -> Result<Vec<Value>, String> {
        let mut events = Vec::new();
        while let Some((end, delimiter_len)) = next_event_boundary(&self.buffer) {
            let block = self.buffer.drain(..end).collect::<Vec<_>>();
            self.buffer.drain(..delimiter_len);
            if let Some(event) = parse_sse_block(&block)? {
                events.push(event);
            }
        }
        if finishing && !self.buffer.is_empty() {
            let block = std::mem::take(&mut self.buffer);
            if let Some(event) = parse_sse_block(&block)? {
                events.push(event);
            }
        }
        Ok(events)
    }
}

fn next_event_boundary(bytes: &[u8]) -> Option<(usize, usize)> {
    let lf = bytes
        .windows(2)
        .position(|window| window == b"\n\n")
        .map(|index| (index, 2));
    let crlf = bytes
        .windows(4)
        .position(|window| window == b"\r\n\r\n")
        .map(|index| (index, 4));
    match (lf, crlf) {
        (Some(left), Some(right)) => Some(if left.0 <= right.0 { left } else { right }),
        (Some(boundary), None) | (None, Some(boundary)) => Some(boundary),
        (None, None) => None,
    }
}

fn parse_sse_block(block: &[u8]) -> Result<Option<Value>, String> {
    let block =
        std::str::from_utf8(block).map_err(|_| "Provider 流式响应包含无效 UTF-8。".to_string())?;
    let data = block
        .lines()
        .filter_map(|line| line.strip_prefix("data:").map(str::trim_start))
        .collect::<Vec<_>>()
        .join("\n");
    if data.is_empty() || data == "[DONE]" {
        return Ok(None);
    }
    serde_json::from_str(&data)
        .map(Some)
        .map_err(|_| "Provider 返回了无法解析的流式事件。".to_string())
}

#[derive(Default)]
struct OpenAiAccumulator {
    completed: Option<Value>,
    output_items: Vec<Value>,
    text_deltas: String,
    reasoning_summary: String,
}

impl OpenAiAccumulator {
    fn accept(&mut self, event: Value, sink: &ProviderStreamSink) -> Result<(), String> {
        match event["type"].as_str() {
            Some("response.created") | Some("response.in_progress") => {
                sink(ProviderStreamEvent::ResponseStarted);
            }
            Some("response.output_text.delta") => {
                if let Some(delta) = event["delta"].as_str() {
                    self.text_deltas.push_str(delta);
                    sink(ProviderStreamEvent::TextDelta(delta.to_string()));
                }
            }
            Some("response.reasoning_summary_text.delta")
            | Some("response.reasoning_summary.delta") => {
                if let Some(delta) = event["delta"].as_str() {
                    self.reasoning_summary.push_str(delta);
                    sink(ProviderStreamEvent::ReasoningSummary(
                        self.reasoning_summary.clone(),
                    ));
                }
            }
            Some("response.output_item.added") => {
                let item = &event["item"];
                if item["type"].as_str() == Some("function_call") {
                    sink(ProviderStreamEvent::ToolInputStarted {
                        call_id: item["call_id"].as_str().unwrap_or_default().to_string(),
                        name: item["name"].as_str().unwrap_or_default().to_string(),
                    });
                }
            }
            Some("response.output_item.done") => {
                if !event["item"].is_null() {
                    self.output_items.push(event["item"].clone());
                }
            }
            Some("response.completed") => self.completed = Some(event["response"].clone()),
            Some("response.failed") => {
                return Err(stream_error_message("OpenAI", &event["response"]));
            }
            Some("error") => return Err(stream_error_message("OpenAI", &event)),
            _ => {}
        }
        Ok(())
    }

    fn finish(self) -> Result<Value, String> {
        let mut response = self.completed.unwrap_or_else(|| json!({}));
        let response_has_output = response["output"]
            .as_array()
            .is_some_and(|output| !output.is_empty());
        if !response_has_output && !self.output_items.is_empty() {
            response["output"] = Value::Array(self.output_items);
        } else if !response_has_output && !self.text_deltas.is_empty() {
            response["output"] = json!([{
                "type": "message",
                "role": "assistant",
                "content": [{ "type": "output_text", "text": self.text_deltas }]
            }]);
        }
        if response["output"].as_array().is_none() {
            return Err("OpenAI 已结束流式响应，但没有返回完成事件。".to_string());
        }
        Ok(response)
    }
}

#[derive(Default)]
struct AnthropicAccumulator {
    message: Value,
    content: Vec<Value>,
    partial_tool_inputs: HashMap<usize, String>,
    reasoning_summary: String,
}

impl AnthropicAccumulator {
    fn accept(&mut self, event: Value, sink: &ProviderStreamSink) -> Result<(), String> {
        match event["type"].as_str() {
            Some("message_start") => {
                self.message = event["message"].clone();
                sink(ProviderStreamEvent::ResponseStarted);
            }
            Some("content_block_start") => {
                let index = event_index(&event)?;
                ensure_block(&mut self.content, index);
                self.content[index] = event["content_block"].clone();
                if self.content[index]["type"].as_str() == Some("tool_use") {
                    sink(ProviderStreamEvent::ToolInputStarted {
                        call_id: self.content[index]["id"]
                            .as_str()
                            .unwrap_or_default()
                            .to_string(),
                        name: self.content[index]["name"]
                            .as_str()
                            .unwrap_or_default()
                            .to_string(),
                    });
                }
            }
            Some("content_block_delta") => {
                let index = event_index(&event)?;
                ensure_block(&mut self.content, index);
                let delta = &event["delta"];
                match delta["type"].as_str() {
                    Some("text_delta") => {
                        if let Some(text) = delta["text"].as_str() {
                            append_string(&mut self.content[index], "text", text);
                            sink(ProviderStreamEvent::TextDelta(text.to_string()));
                        }
                    }
                    Some("input_json_delta") => {
                        if let Some(partial) = delta["partial_json"].as_str() {
                            self.partial_tool_inputs
                                .entry(index)
                                .or_default()
                                .push_str(partial);
                        }
                    }
                    Some("thinking_delta") => {
                        if let Some(thinking) = delta["thinking"].as_str() {
                            append_string(&mut self.content[index], "thinking", thinking);
                            self.reasoning_summary.push_str(thinking);
                            sink(ProviderStreamEvent::ReasoningSummary(
                                self.reasoning_summary.clone(),
                            ));
                        }
                    }
                    Some("signature_delta") => {
                        if let Some(signature) = delta["signature"].as_str() {
                            self.content[index]["signature"] = json!(signature);
                        }
                    }
                    _ => {}
                }
            }
            Some("content_block_stop") => {
                let index = event_index(&event)?;
                if let Some(input) = self.partial_tool_inputs.remove(&index) {
                    let input = if input.trim().is_empty() {
                        json!({})
                    } else {
                        serde_json::from_str(&input)
                            .map_err(|_| "Anthropic 返回了无效工具参数。".to_string())?
                    };
                    ensure_block(&mut self.content, index);
                    self.content[index]["input"] = input;
                }
            }
            Some("message_delta") => {
                if !event["delta"]["stop_reason"].is_null() {
                    self.message["stop_reason"] = event["delta"]["stop_reason"].clone();
                }
                if !event["usage"].is_null() {
                    merge_object(&mut self.message["usage"], &event["usage"]);
                }
            }
            Some("error") => return Err(stream_error_message("Anthropic", &event)),
            _ => {}
        }
        Ok(())
    }

    fn finish(mut self) -> Result<Value, String> {
        if !self.partial_tool_inputs.is_empty() {
            return Err("Anthropic 工具参数流未完整结束。".to_string());
        }
        if !self.message.is_object() {
            return Err("Anthropic 已结束流式响应，但没有返回 message_start。".to_string());
        }
        self.message["content"] = Value::Array(self.content);
        Ok(self.message)
    }
}

fn event_index(event: &Value) -> Result<usize, String> {
    event["index"]
        .as_u64()
        .map(|value| value as usize)
        .ok_or_else(|| "Provider 流式内容块缺少 index。".to_string())
}

fn ensure_block(blocks: &mut Vec<Value>, index: usize) {
    while blocks.len() <= index {
        blocks.push(json!({}));
    }
}

fn append_string(value: &mut Value, field: &str, delta: &str) {
    let mut text = value[field].as_str().unwrap_or_default().to_string();
    text.push_str(delta);
    value[field] = json!(text);
}

fn merge_object(target: &mut Value, update: &Value) {
    if !target.is_object() {
        *target = json!({});
    }
    let Some(target) = target.as_object_mut() else {
        return;
    };
    if let Some(update) = update.as_object() {
        for (key, value) in update {
            target.insert(key.clone(), value.clone());
        }
    }
}

fn stream_error_message(provider: &str, value: &Value) -> String {
    let message = value["error"]["message"]
        .as_str()
        .or_else(|| value["message"].as_str())
        .unwrap_or("流式响应失败");
    format!(
        "{provider} 流式响应失败：{}",
        message.chars().take(500).collect::<String>()
    )
}

#[cfg(test)]
mod tests {
    use super::{AnthropicAccumulator, OpenAiAccumulator, ProviderStreamEvent, SseDecoder};
    use serde_json::json;
    use std::sync::{Arc, Mutex};

    #[test]
    fn decoder_handles_chatgpt_sse_without_header_metadata_and_split_utf8() {
        let source = "data: {\"type\":\"response.output_text.delta\",\"delta\":\"你好\"}\n\ndata: [DONE]\n\n";
        let bytes = source.as_bytes();
        let split = source.find('好').unwrap() + 1;
        let mut decoder = SseDecoder::default();
        assert!(decoder.push(&bytes[..split]).unwrap().is_empty());
        let events = decoder.push(&bytes[split..]).unwrap();
        assert_eq!(events.len(), 1);
        assert_eq!(events[0]["delta"], "你好");
    }

    #[test]
    fn openai_accumulator_streams_text_and_keeps_completed_response() {
        let emitted = Arc::new(Mutex::new(Vec::new()));
        let capture = emitted.clone();
        let sink: super::ProviderStreamSink =
            Arc::new(move |event| capture.lock().unwrap().push(event));
        let mut accumulator = OpenAiAccumulator::default();
        accumulator
            .accept(
                json!({ "type": "response.output_text.delta", "delta": "正文" }),
                &sink,
            )
            .unwrap();
        accumulator
            .accept(json!({
                "type": "response.completed",
                "response": { "output": [{ "type": "message", "content": [{ "type": "output_text", "text": "正文" }] }] }
            }), &sink)
            .unwrap();
        assert_eq!(
            emitted.lock().unwrap().as_slice(),
            &[ProviderStreamEvent::TextDelta("正文".to_string())]
        );
        assert_eq!(
            accumulator.finish().unwrap()["output"][0]["type"],
            "message"
        );
    }

    #[test]
    fn anthropic_accumulator_rebuilds_text_and_tool_input() {
        let sink: super::ProviderStreamSink = Arc::new(|_| {});
        let mut accumulator = AnthropicAccumulator::default();
        accumulator
            .accept(
                json!({ "type": "message_start", "message": { "type": "message", "content": [], "usage": { "input_tokens": 4 } } }),
                &sink,
            )
            .unwrap();
        accumulator
            .accept(json!({ "type": "content_block_start", "index": 0, "content_block": { "type": "text", "text": "" } }), &sink)
            .unwrap();
        accumulator
            .accept(json!({ "type": "content_block_delta", "index": 0, "delta": { "type": "text_delta", "text": "完成" } }), &sink)
            .unwrap();
        accumulator
            .accept(json!({ "type": "content_block_start", "index": 1, "content_block": { "type": "tool_use", "id": "tool-1", "name": "read_markdown", "input": {} } }), &sink)
            .unwrap();
        accumulator
            .accept(json!({ "type": "content_block_delta", "index": 1, "delta": { "type": "input_json_delta", "partial_json": "{\"path\":\"draft.md\"}" } }), &sink)
            .unwrap();
        accumulator
            .accept(json!({ "type": "content_block_stop", "index": 1 }), &sink)
            .unwrap();
        let message = accumulator.finish().unwrap();
        assert_eq!(message["content"][0]["text"], "完成");
        assert_eq!(message["content"][1]["input"]["path"], "draft.md");
    }
}
