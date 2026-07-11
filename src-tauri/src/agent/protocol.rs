use crate::models::AgentRuntimeSettings;
use std::path::Path;

pub(crate) fn build_app_server_thread_start(
    library_path: &Path,
    runtime: &AgentRuntimeSettings,
) -> serde_json::Value {
    serde_json::json!({
        "jsonrpc": "2.0",
        "id": 2,
        "method": "thread/start",
        "params": {
            "cwd": library_path.display().to_string(),
            "model": normalized_runtime_model(runtime),
            "serviceTier": runtime_service_tier(runtime),
            "approvalPolicy": "on-request",
            "approvalsReviewer": "user",
            "sandbox": "workspace-write",
            "threadSource": "nibva",
            "sessionStartSource": "clear",
        },
    })
}

pub(crate) fn build_app_server_thread_resume(
    thread_id: &str,
    library_path: &Path,
    runtime: &AgentRuntimeSettings,
) -> serde_json::Value {
    serde_json::json!({
        "jsonrpc": "2.0",
        "id": 2,
        "method": "thread/resume",
        "params": {
            "threadId": thread_id,
            "cwd": library_path.display().to_string(),
            "model": normalized_runtime_model(runtime),
            "serviceTier": runtime_service_tier(runtime),
            "approvalPolicy": "on-request",
            "approvalsReviewer": "user",
            "sandbox": "workspace-write",
        },
    })
}

pub(crate) fn build_app_server_turn_start(
    thread_id: &str,
    library_path: &Path,
    full_prompt: &str,
    runtime: &AgentRuntimeSettings,
) -> serde_json::Value {
    serde_json::json!({
        "jsonrpc": "2.0",
        "id": 3,
        "method": "turn/start",
        "params": {
            "threadId": thread_id,
            "input": [{
                "type": "text",
                "text": full_prompt,
                "text_elements": [],
            }],
            "cwd": library_path.display().to_string(),
            "model": normalized_runtime_model(runtime),
            "serviceTier": runtime_service_tier(runtime),
            "effort": normalized_runtime_effort(runtime),
            "approvalPolicy": "on-request",
            "approvalsReviewer": "user",
        },
    })
}

pub(crate) fn is_json_rpc_error(value: &serde_json::Value) -> bool {
    value.get("error").is_some()
}

pub(crate) fn format_json_rpc_error(value: &serde_json::Value) -> String {
    value
        .get("error")
        .and_then(|error| error.get("message"))
        .and_then(|message| message.as_str())
        .unwrap_or("Codex app-server returned an error.")
        .to_string()
}

pub(crate) fn is_app_server_approval_request(method: &str) -> bool {
    matches!(
        method,
        "item/commandExecution/requestApproval"
            | "item/fileChange/requestApproval"
            | "item/permissions/requestApproval"
            | "applyPatchApproval"
            | "execCommandApproval"
    )
}

pub(crate) fn normalize_approval_decision(decision: &str) -> String {
    match decision {
        "accept" | "acceptForSession" | "cancel" => decision.to_string(),
        _ => "decline".to_string(),
    }
}

pub(crate) fn build_app_server_approval_response(
    request: &serde_json::Value,
    decision: &str,
) -> serde_json::Value {
    let id = request
        .get("id")
        .cloned()
        .unwrap_or(serde_json::Value::Null);
    serde_json::json!({
        "jsonrpc": "2.0",
        "id": id,
        "result": {
            "decision": decision,
        },
    })
}

fn normalized_runtime_model(runtime: &AgentRuntimeSettings) -> Option<String> {
    let model = runtime.model.trim();
    if model.is_empty() || model == "auto" {
        None
    } else {
        Some(model.to_string())
    }
}

fn normalized_runtime_effort(runtime: &AgentRuntimeSettings) -> Option<String> {
    let effort = runtime.reasoning_effort.trim();
    if effort.is_empty() {
        None
    } else {
        Some(effort.to_string())
    }
}

fn runtime_service_tier(runtime: &AgentRuntimeSettings) -> &'static str {
    if runtime.quick_mode {
        "priority"
    } else {
        "default"
    }
}
