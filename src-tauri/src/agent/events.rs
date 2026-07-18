use crate::models::{AgentChatStreamEvent, AgentUsage};
use tauri::Emitter;

pub(crate) fn emit_app_server_approval_request(
    window: &tauri::Window,
    request_id: &str,
    method: &str,
    value: &serde_json::Value,
    approval_id: &str,
) {
    let params = value.get("params").unwrap_or(&serde_json::Value::Null);
    let mut event = empty_agent_event(request_id, "approval");
    event.raw_type = method.to_string();
    event.item_id = approval_id.to_string();
    event.item_type = "approval".to_string();
    event.status = "pending".to_string();
    event.title = app_server_approval_title(method).to_string();
    event.command = params
        .get("command")
        .and_then(|value| value.as_str())
        .unwrap_or_default()
        .to_string();
    event.text = params
        .get("reason")
        .and_then(|value| value.as_str())
        .unwrap_or("请确认是否允许 Codex 执行该操作。")
        .to_string();
    emit_agent_event(window, event);
}

pub(crate) fn emit_app_server_notification(
    window: &tauri::Window,
    request_id: &str,
    method: &str,
    value: &serde_json::Value,
) -> bool {
    match method {
        "thread/status/changed" => {
            let params = value.get("params").unwrap_or(&serde_json::Value::Null);
            let status = params
                .get("status")
                .and_then(|status| status.get("type"))
                .and_then(|value| value.as_str())
                .unwrap_or_default();
            let mut event = empty_agent_event(request_id, "status");
            event.raw_type = method.to_string();
            event.title = match status {
                "active" => "Codex 正在运行",
                "idle" => "Codex 空闲",
                _ => "Codex 状态更新",
            }
            .to_string();
            event.status = status.to_string();
            emit_agent_event(window, event);
        }
        "turn/started" => {
            let mut event = empty_agent_event(request_id, "status");
            event.raw_type = method.to_string();
            event.title = "开始处理".to_string();
            event.status = app_server_turn_id(value);
            emit_agent_event(window, event);
        }
        "turn/completed" => {
            let mut event = empty_agent_event(request_id, "status");
            event.raw_type = method.to_string();
            event.title = "本轮完成".to_string();
            event.status = app_server_turn_id(value);
            emit_agent_event(window, event);
            return true;
        }
        "warning" | "configWarning" | "guardianWarning" | "deprecationNotice" => {
            let params = value.get("params").unwrap_or(&serde_json::Value::Null);
            let mut event = empty_agent_event(request_id, "activity");
            event.raw_type = method.to_string();
            event.item_id = method.to_string();
            event.item_type = "warning".to_string();
            event.title = "Codex 提示".to_string();
            event.text = params
                .get("message")
                .or_else(|| params.get("text"))
                .and_then(|value| value.as_str())
                .unwrap_or_default()
                .to_string();
            emit_agent_event(window, event);
        }
        "thread/settings/updated" => {
            let params = value.get("params").unwrap_or(&serde_json::Value::Null);
            let settings = params
                .get("threadSettings")
                .unwrap_or(&serde_json::Value::Null);
            let model = settings
                .get("model")
                .and_then(|value| value.as_str())
                .unwrap_or_default();
            let effort = settings
                .get("effort")
                .and_then(|value| value.as_str())
                .unwrap_or_default();
            let service_tier = settings
                .get("serviceTier")
                .and_then(|value| value.as_str())
                .unwrap_or_default();
            let mut event = empty_agent_event(request_id, "status");
            event.raw_type = method.to_string();
            event.title = "运行配置已应用".to_string();
            event.status = [model, effort, service_tier]
                .into_iter()
                .filter(|part| !part.is_empty())
                .collect::<Vec<_>>()
                .join(" / ");
            emit_agent_event(window, event);
        }
        "item/agentMessage/delta" => {
            if let Some((item_id, delta)) = parse_app_server_agent_message_delta(value) {
                let mut event = empty_agent_event(request_id, "delta");
                event.raw_type = method.to_string();
                event.item_id = item_id;
                event.item_type = "agentMessage".to_string();
                event.text = delta;
                emit_agent_event(window, event);
            }
        }
        "item/started" | "item/completed" => {
            if let Some(item) = value.get("params").and_then(|params| params.get("item")) {
                emit_app_server_item_event(window, request_id, method, item);
            }
        }
        "item/commandExecution/outputDelta"
        | "command/exec/outputDelta"
        | "process/outputDelta"
        | "item/fileChange/outputDelta"
        | "item/mcpToolCall/progress"
        | "item/reasoning/summaryTextDelta"
        | "item/reasoning/textDelta"
        | "item/plan/delta" => {
            emit_app_server_delta_activity(window, request_id, method, value);
        }
        "thread/tokenUsage/updated" => {
            if let Some(usage) = value
                .get("params")
                .and_then(|params| params.get("tokenUsage"))
                .and_then(|usage| usage.get("last").or_else(|| usage.get("total")))
            {
                let mut event = empty_agent_event(request_id, "usage");
                event.raw_type = method.to_string();
                event.title = "用量更新".to_string();
                event.usage = Some(parse_app_server_token_usage(usage));
                emit_agent_event(window, event);
            }
        }
        "mcpServer/startupStatus/updated" => {
            let params = value.get("params").unwrap_or(&serde_json::Value::Null);
            let name = params
                .get("name")
                .and_then(|value| value.as_str())
                .unwrap_or("MCP");
            let status = params
                .get("status")
                .and_then(|value| value.as_str())
                .unwrap_or_default();
            if status == "failed" {
                let mut event = empty_agent_event(request_id, "activity");
                event.raw_type = method.to_string();
                event.item_id = format!("mcp:{name}");
                event.item_type = "mcp".to_string();
                event.title = format!("MCP {name} 启动失败");
                event.status = status.to_string();
                event.text = params
                    .get("error")
                    .and_then(|value| value.as_str())
                    .unwrap_or_default()
                    .to_string();
                emit_agent_event(window, event);
            }
        }
        _ => {}
    }
    false
}

pub(crate) fn emit_agent_stream_event(
    window: &tauri::Window,
    request_id: &str,
    kind: &str,
    text: &str,
    error: &str,
) {
    let _ = window.emit(
        "loby://agent-chat-stream",
        AgentChatStreamEvent {
            request_id: request_id.to_string(),
            kind: kind.to_string(),
            text: text.to_string(),
            error: error.to_string(),
            raw_type: String::new(),
            item_id: String::new(),
            item_type: String::new(),
            status: String::new(),
            title: String::new(),
            command: String::new(),
            output: String::new(),
            exit_code: None,
            usage: None,
        },
    );
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
        status: String::new(),
        title: String::new(),
        command: String::new(),
        output: String::new(),
        exit_code: None,
        usage: None,
    }
}

pub(crate) fn emit_agent_event(window: &tauri::Window, event: AgentChatStreamEvent) {
    let _ = window.emit("loby://agent-chat-stream", event);
}

pub(crate) fn parse_app_server_token_usage(value: &serde_json::Value) -> AgentUsage {
    AgentUsage {
        input_tokens: value
            .get("inputTokens")
            .and_then(|value| value.as_u64())
            .unwrap_or_default(),
        cached_input_tokens: value
            .get("cachedInputTokens")
            .and_then(|value| value.as_u64())
            .unwrap_or_default(),
        output_tokens: value
            .get("outputTokens")
            .and_then(|value| value.as_u64())
            .unwrap_or_default(),
        reasoning_output_tokens: value
            .get("reasoningOutputTokens")
            .and_then(|value| value.as_u64())
            .unwrap_or_default(),
    }
}

pub(crate) fn parse_app_server_agent_message_delta(
    value: &serde_json::Value,
) -> Option<(String, String)> {
    let params = value.get("params")?;
    let delta = params.get("delta")?.as_str()?;
    let item_id = params
        .get("itemId")
        .and_then(|value| value.as_str())
        .unwrap_or_default();
    Some((item_id.to_string(), delta.to_string()))
}

fn app_server_approval_title(method: &str) -> &'static str {
    match method {
        "item/commandExecution/requestApproval" | "execCommandApproval" => "需要命令审批",
        "item/fileChange/requestApproval" | "applyPatchApproval" => "需要文件修改审批",
        "item/permissions/requestApproval" => "需要权限审批",
        _ => "需要用户确认",
    }
}

fn app_server_turn_id(value: &serde_json::Value) -> String {
    value
        .get("params")
        .and_then(|params| params.get("turn"))
        .and_then(|turn| turn.get("id"))
        .and_then(|value| value.as_str())
        .unwrap_or_default()
        .to_string()
}

fn emit_app_server_item_event(
    window: &tauri::Window,
    request_id: &str,
    method: &str,
    item: &serde_json::Value,
) {
    let item_type = item
        .get("type")
        .and_then(|value| value.as_str())
        .unwrap_or_default();
    if item_type == "agentMessage" || item_type == "userMessage" {
        return;
    }
    let mut event = empty_agent_event(request_id, "activity");
    event.raw_type = method.to_string();
    event.item_id = item
        .get("id")
        .and_then(|value| value.as_str())
        .unwrap_or_default()
        .to_string();
    event.item_type = item_type.to_string();
    event.status = if method == "item/started" {
        "in_progress"
    } else {
        "completed"
    }
    .to_string();
    event.title = app_server_item_title(item_type, method).to_string();
    event.command = item
        .get("command")
        .and_then(|value| value.as_str())
        .unwrap_or_default()
        .to_string();
    event.output = item
        .get("aggregated_output")
        .or_else(|| item.get("output"))
        .and_then(|value| value.as_str())
        .unwrap_or_default()
        .to_string();
    event.text = item
        .get("message")
        .or_else(|| item.get("text"))
        .and_then(|value| value.as_str())
        .unwrap_or_default()
        .to_string();
    event.exit_code = item
        .get("exit_code")
        .or_else(|| item.get("exitCode"))
        .and_then(|value| value.as_i64());
    emit_agent_event(window, event);
}

fn app_server_item_title(item_type: &str, method: &str) -> &'static str {
    match item_type {
        "commandExecution" => "运行命令",
        "mcpToolCall" => "调用工具",
        "fileChange" => "文件修改",
        "reasoning" => "思考过程",
        "plan" => "更新计划",
        "error" => "Codex 提示",
        _ if method == "item/started" => "开始工具步骤",
        _ => "完成工具步骤",
    }
}

fn emit_app_server_delta_activity(
    window: &tauri::Window,
    request_id: &str,
    method: &str,
    value: &serde_json::Value,
) {
    let params = value.get("params").unwrap_or(&serde_json::Value::Null);
    let mut event = empty_agent_event(request_id, "activity");
    event.raw_type = method.to_string();
    event.item_id = params
        .get("itemId")
        .or_else(|| params.get("processId"))
        .and_then(|value| value.as_str())
        .unwrap_or(method)
        .to_string();
    event.item_type = method.to_string();
    event.status = "in_progress".to_string();
    event.title = app_server_delta_title(method).to_string();
    event.output = params
        .get("delta")
        .or_else(|| params.get("text"))
        .or_else(|| params.get("output"))
        .and_then(|value| value.as_str())
        .unwrap_or_default()
        .to_string();
    emit_agent_event(window, event);
}

fn app_server_delta_title(method: &str) -> &'static str {
    match method {
        "item/commandExecution/outputDelta"
        | "command/exec/outputDelta"
        | "process/outputDelta" => "命令输出",
        "item/fileChange/outputDelta" => "文件修改输出",
        "item/mcpToolCall/progress" => "工具进度",
        "item/reasoning/summaryTextDelta" | "item/reasoning/textDelta" => "思考过程",
        "item/plan/delta" => "计划更新",
        _ => "运行过程",
    }
}
