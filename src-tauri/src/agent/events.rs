//! [INPUT]: 依赖 AgentChatStreamEvent/AgentUsage 模型与 Tauri Emitter
//! [OUTPUT]: 向 Agent Runtime 提供请求级 started/message/activity/usage/metric/terminal 事件构造与发射
//! [POS]: 本地 AI agent 的稳定事件桥；Provider、Tool 与 MCP 原始协议不得穿透到 renderer
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use crate::models::{AgentChatStreamEvent, AgentUsage};
use tauri::Emitter;

const AGENT_STREAM_EVENT_PREFIX: &str = "loby://agent-chat-stream/";

pub(crate) fn agent_stream_event_name(request_id: &str) -> String {
    let safe_request_id = request_id
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || matches!(character, '-' | '_') {
                character
            } else {
                '_'
            }
        })
        .collect::<String>();
    format!("{AGENT_STREAM_EVENT_PREFIX}{safe_request_id}")
}

pub(crate) fn emit_agent_stream_event(
    window: &tauri::Window,
    request_id: &str,
    kind: &str,
    text: &str,
    error: &str,
) {
    let mut event = empty_agent_event(request_id, kind);
    event.text = text.to_string();
    event.error = error.to_string();
    emit_agent_event(window, event);
}

pub(crate) fn emit_agent_message(window: &tauri::Window, request_id: &str, text: &str) {
    let mut event = empty_agent_event(request_id, "message");
    event.raw_type = "agent/message/completed".to_string();
    event.item_id = format!("message-{request_id}");
    event.item_type = "agentMessage".to_string();
    event.phase = "final_answer".to_string();
    event.text = text.to_string();
    emit_agent_event(window, event);
}

pub(crate) fn emit_agent_activity(
    window: &tauri::Window,
    request_id: &str,
    item_id: &str,
    title: &str,
    status: &str,
    text: &str,
    artifact_path: Option<&str>,
) {
    let mut event = empty_agent_event(request_id, "activity");
    event.raw_type = "agent/tool".to_string();
    event.item_id = item_id.to_string();
    event.item_type = "toolCall".to_string();
    event.title = title.to_string();
    event.status = status.to_string();
    event.text = text.to_string();
    event.artifact_path = artifact_path.unwrap_or_default().to_string();
    emit_agent_event(window, event);
}

pub(crate) fn emit_agent_approval(
    window: &tauri::Window,
    request_id: &str,
    approval_id: &str,
    title: &str,
    reason: &str,
) {
    let mut event = empty_agent_event(request_id, "approval");
    event.raw_type = "agent/tool/requestApproval".to_string();
    event.item_id = approval_id.to_string();
    event.item_type = "approval".to_string();
    event.title = title.to_string();
    event.status = "pending".to_string();
    event.text = reason.to_string();
    emit_agent_event(window, event);
}

pub(crate) fn emit_agent_usage(window: &tauri::Window, request_id: &str, usage: AgentUsage) {
    let mut event = empty_agent_event(request_id, "usage");
    event.raw_type = "agent/usage".to_string();
    event.title = "用量更新".to_string();
    event.usage = Some(usage);
    emit_agent_event(window, event);
}

pub(crate) fn emit_agent_metric(
    window: &tauri::Window,
    request_id: &str,
    raw_type: &str,
    status: &str,
    elapsed_ms: u64,
) {
    let mut event = empty_agent_event(request_id, "metric");
    event.raw_type = raw_type.to_string();
    event.status = status.to_string();
    event.elapsed_ms = Some(elapsed_ms);
    emit_agent_event(window, event);
}

pub(crate) fn empty_agent_event(request_id: &str, kind: &str) -> AgentChatStreamEvent {
    AgentChatStreamEvent {
        request_id: request_id.to_string(),
        kind: kind.to_string(),
        text: String::new(),
        error: String::new(),
        raw_type: String::new(),
        item_id: String::new(),
        item_type: String::new(),
        phase: String::new(),
        status: String::new(),
        title: String::new(),
        command: String::new(),
        output: String::new(),
        artifact_path: String::new(),
        exit_code: None,
        usage: None,
        elapsed_ms: None,
    }
}

pub(crate) fn emit_agent_event(window: &tauri::Window, event: AgentChatStreamEvent) {
    let event_name = agent_stream_event_name(&event.request_id);
    let _ = window.emit(event_name.as_str(), event);
}

#[cfg(test)]
mod tests {
    use super::{agent_stream_event_name, empty_agent_event};

    #[test]
    fn event_name_sanitizes_untrusted_request_id() {
        assert_eq!(
            agent_stream_event_name("request/one:two"),
            "loby://agent-chat-stream/request_one_two"
        );
    }

    #[test]
    fn empty_event_never_leaks_optional_payloads() {
        let event = empty_agent_event("request-1", "started");
        assert_eq!(event.request_id, "request-1");
        assert!(event.text.is_empty());
        assert!(event.usage.is_none());
    }
}
