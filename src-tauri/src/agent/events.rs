//! [INPUT]: 依赖 AgentChatStreamEvent/AgentUsage 模型与 Tauri Emitter
//! [OUTPUT]: 向 Agent Runtime 提供带 sequence、权威 run phase、类型化 activity 生命周期及 proposal/usage/terminal 的请求级事件
//! [POS]: 本地 AI agent 的稳定事件协议；Provider、Tool 与 MCP 原始协议不得穿透到 renderer，UI 不得再从标题猜运行事实
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use crate::models::{
    AgentActivityKind, AgentActivityState, AgentActivityVisibility, AgentChatStreamEvent,
    AgentRunPhase, AgentUsage,
};
use serde_json::Value;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Emitter;

const AGENT_STREAM_EVENT_PREFIX: &str = "loby://agent-chat-stream/";
static AGENT_EVENT_SEQUENCE: AtomicU64 = AtomicU64::new(1);

pub(crate) struct AgentActivity {
    item_id: String,
    kind: AgentActivityKind,
    state: AgentActivityState,
    visibility: AgentActivityVisibility,
    title: String,
    text: String,
    tool_name: String,
    artifact_path: String,
    parent_id: String,
}

impl AgentActivity {
    pub(crate) fn new(
        item_id: impl Into<String>,
        kind: AgentActivityKind,
        state: AgentActivityState,
        visibility: AgentActivityVisibility,
    ) -> Self {
        Self {
            item_id: item_id.into(),
            kind,
            state,
            visibility,
            title: String::new(),
            text: String::new(),
            tool_name: String::new(),
            artifact_path: String::new(),
            parent_id: String::new(),
        }
    }

    pub(crate) fn title(mut self, title: impl Into<String>) -> Self {
        self.title = title.into();
        self
    }

    pub(crate) fn text(mut self, text: impl Into<String>) -> Self {
        self.text = text.into();
        self
    }

    pub(crate) fn tool_name(mut self, tool_name: impl Into<String>) -> Self {
        self.tool_name = tool_name.into();
        self
    }

    pub(crate) fn artifact_path(mut self, artifact_path: Option<&str>) -> Self {
        self.artifact_path = artifact_path.unwrap_or_default().to_string();
        self
    }

    pub(crate) fn parent_id(mut self, parent_id: impl Into<String>) -> Self {
        self.parent_id = parent_id.into();
        self
    }
}

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

pub(crate) fn emit_agent_run_state(
    window: &tauri::Window,
    request_id: &str,
    phase: AgentRunPhase,
    active_item_id: Option<&str>,
) {
    let mut event = empty_agent_event(request_id, "state");
    event.raw_type = "agent/run/state".to_string();
    event.item_type = "runState".to_string();
    event.run_phase = Some(phase);
    event.active_item_id = active_item_id.unwrap_or_default().to_string();
    emit_agent_event(window, event);
}

pub(crate) fn emit_agent_delta(window: &tauri::Window, request_id: &str, text: &str) {
    let mut event = empty_agent_event(request_id, "delta");
    event.raw_type = "agent/message/delta".to_string();
    event.item_id = format!("message-{request_id}");
    event.item_type = "agentMessage".to_string();
    event.phase = "final_answer".to_string();
    event.text = text.to_string();
    emit_agent_event(window, event);
}

pub(crate) fn emit_agent_reasoning(
    window: &tauri::Window,
    request_id: &str,
    item_id: &str,
    state: AgentActivityState,
    text: &str,
) {
    emit_agent_activity(
        window,
        request_id,
        AgentActivity::new(
            item_id,
            AgentActivityKind::Reasoning,
            state,
            AgentActivityVisibility::Detail,
        )
        .title("整理思路")
        .text(text),
    );
}

pub(crate) fn emit_agent_activity(
    window: &tauri::Window,
    request_id: &str,
    activity: AgentActivity,
) {
    emit_agent_event(window, agent_activity_event(request_id, activity));
}

fn agent_activity_event(request_id: &str, activity: AgentActivity) -> AgentChatStreamEvent {
    let mut event = empty_agent_event(request_id, "activity");
    let kind_name = activity_kind_name(activity.kind);
    event.raw_type = format!("agent/activity/{kind_name}");
    event.item_id = activity.item_id;
    event.item_type = kind_name.to_string();
    event.activity_kind = Some(activity.kind);
    event.activity_state = Some(activity.state);
    event.visibility = Some(activity.visibility);
    event.title = activity.title;
    event.status = legacy_activity_status(activity.state).to_string();
    event.text = activity.text;
    event.tool_name = activity.tool_name;
    event.artifact_path = activity.artifact_path;
    event.parent_id = activity.parent_id;
    event
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
    event.activity_kind = Some(AgentActivityKind::Approval);
    event.activity_state = Some(AgentActivityState::AwaitingApproval);
    event.visibility = Some(AgentActivityVisibility::Milestone);
    event.title = title.to_string();
    event.status = "pending".to_string();
    event.text = reason.to_string();
    emit_agent_event(window, event);
}

pub(crate) fn emit_agent_proposal(
    window: &tauri::Window,
    request_id: &str,
    item_id: &str,
    tool_name: &str,
    proposal_kind: &str,
    title: &str,
    payload: &Value,
) {
    let mut event = empty_agent_event(request_id, "proposal");
    event.raw_type = format!("agent/proposal/{tool_name}");
    event.item_id = item_id.to_string();
    event.item_type = "proposal".to_string();
    event.activity_kind = Some(AgentActivityKind::Proposal);
    event.activity_state = Some(AgentActivityState::Completed);
    event.visibility = Some(AgentActivityVisibility::Milestone);
    event.status = "completed".to_string();
    event.title = title.to_string();
    event.proposal_kind = proposal_kind.to_string();
    event.tool_name = tool_name.to_string();
    event.payload = Some(payload.clone());
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
        sequence: AGENT_EVENT_SEQUENCE.fetch_add(1, Ordering::Relaxed),
        emitted_at_ms: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_millis() as u64)
            .unwrap_or_default(),
        kind: kind.to_string(),
        text: String::new(),
        error: String::new(),
        raw_type: String::new(),
        item_id: String::new(),
        item_type: String::new(),
        activity_kind: None,
        activity_state: None,
        visibility: None,
        run_phase: None,
        active_item_id: String::new(),
        parent_id: String::new(),
        phase: String::new(),
        status: String::new(),
        title: String::new(),
        command: String::new(),
        output: String::new(),
        artifact_path: String::new(),
        proposal_kind: String::new(),
        tool_name: String::new(),
        payload: None,
        exit_code: None,
        usage: None,
        elapsed_ms: None,
    }
}

fn activity_kind_name(kind: AgentActivityKind) -> &'static str {
    match kind {
        AgentActivityKind::Reasoning => "reasoning",
        AgentActivityKind::Skill => "skill",
        AgentActivityKind::Tool => "tool",
        AgentActivityKind::WebSearch => "webSearch",
        AgentActivityKind::ImageGeneration => "imageGeneration",
        AgentActivityKind::Approval => "approval",
        AgentActivityKind::Proposal => "proposal",
        AgentActivityKind::Status => "status",
    }
}

fn legacy_activity_status(state: AgentActivityState) -> &'static str {
    match state {
        AgentActivityState::Queued => "queued",
        AgentActivityState::Running => "in_progress",
        AgentActivityState::AwaitingApproval => "pending",
        AgentActivityState::Completed => "completed",
        AgentActivityState::Failed => "failed",
        AgentActivityState::Cancelled => "cancelled",
    }
}

pub(crate) fn emit_agent_event(window: &tauri::Window, event: AgentChatStreamEvent) {
    let event_name = agent_stream_event_name(&event.request_id);
    let _ = window.emit(event_name.as_str(), event);
}

#[cfg(test)]
mod tests {
    use super::{agent_activity_event, agent_stream_event_name, empty_agent_event, AgentActivity};
    use crate::models::{AgentActivityKind, AgentActivityState, AgentActivityVisibility};

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
        assert!(event.sequence > 0);
        assert!(event.emitted_at_ms > 0);
        assert!(event.usage.is_none());
    }

    #[test]
    fn activity_event_carries_typed_lifecycle_without_title_inference() {
        let event = agent_activity_event(
            "request-1",
            AgentActivity::new(
                "tool-image",
                AgentActivityKind::ImageGeneration,
                AgentActivityState::Running,
                AgentActivityVisibility::Milestone,
            )
            .title("任意本地化标题")
            .tool_name("generate_image")
            .parent_id("provider-step-1"),
        );

        assert_eq!(event.raw_type, "agent/activity/imageGeneration");
        assert_eq!(event.item_type, "imageGeneration");
        assert_eq!(
            event.activity_kind,
            Some(AgentActivityKind::ImageGeneration)
        );
        assert_eq!(event.activity_state, Some(AgentActivityState::Running));
        assert_eq!(event.visibility, Some(AgentActivityVisibility::Milestone));
        assert_eq!(event.tool_name, "generate_image");
        assert_eq!(event.parent_id, "provider-step-1");
    }
}
