//! [INPUT]: 依赖 AgentRuntimeSettings、受控附件解析结果、serde_json request/value 构造与受控工作目录路径
//! [OUTPUT]: 向 crate 提供带落笔轻量能力配置的 thread start/resume/read、含 localImage/mention 的 turn start、turn steer/interrupt、错误识别与审批决策归一化能力
//! [POS]: 本地 AI agent 领域的 JSON-RPC 构造边界，隔离全局 Codex 上下文并保留用户显式选择的插件能力
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use super::assistant_attachments::{AssistantAttachmentKind, ResolvedAssistantAttachment};
use crate::models::AgentRuntimeSettings;
use std::path::Path;

const LOBY_BASE_INSTRUCTIONS: &str = "你是落笔（Loby）的 AI 写作助手。帮助作者思考、组织和修改内容，始终保留作者控制权。遵守本轮提供的写作上下文与输出协议；只在任务确实需要时使用工具。使用中文简洁回答。";
const LOBY_DEVELOPER_INSTRUCTIONS: &str =
    "把落笔提供的当前文稿、挂载资源和动作协议视为本轮权威边界。不要主动扩展到无关工程任务。";

pub(crate) fn build_app_server_thread_start(
    request_id: u64,
    library_path: &Path,
    runtime: &AgentRuntimeSettings,
) -> serde_json::Value {
    serde_json::json!({
        "jsonrpc": "2.0",
        "id": request_id,
        "method": "thread/start",
        "params": {
            "cwd": library_path.display().to_string(),
            "model": normalized_runtime_model(runtime),
            "serviceTier": runtime_service_tier(runtime),
            "approvalPolicy": runtime_approval_policy(runtime),
            "approvalsReviewer": "user",
            "sandbox": runtime_sandbox(runtime),
            "baseInstructions": LOBY_BASE_INSTRUCTIONS,
            "developerInstructions": LOBY_DEVELOPER_INSTRUCTIONS,
            "threadSource": "loby",
            "sessionStartSource": "clear",
            "config": loby_thread_config(runtime),
        },
    })
}

pub(crate) fn build_app_server_thread_resume(
    request_id: u64,
    thread_id: &str,
    library_path: &Path,
    runtime: &AgentRuntimeSettings,
) -> serde_json::Value {
    serde_json::json!({
        "jsonrpc": "2.0",
        "id": request_id,
        "method": "thread/resume",
        "params": {
            "threadId": thread_id,
            "cwd": library_path.display().to_string(),
            "model": normalized_runtime_model(runtime),
            "serviceTier": runtime_service_tier(runtime),
            "approvalPolicy": runtime_approval_policy(runtime),
            "approvalsReviewer": "user",
            "sandbox": runtime_sandbox(runtime),
            "baseInstructions": LOBY_BASE_INSTRUCTIONS,
            "developerInstructions": LOBY_DEVELOPER_INSTRUCTIONS,
            "config": loby_thread_config(runtime),
        },
    })
}

pub(crate) fn build_app_server_thread_read(request_id: u64, thread_id: &str) -> serde_json::Value {
    serde_json::json!({
        "jsonrpc": "2.0",
        "id": request_id,
        "method": "thread/read",
        "params": {
            "threadId": thread_id,
            "includeTurns": true,
        },
    })
}

pub(crate) fn build_app_server_turn_start(
    request_id: u64,
    thread_id: &str,
    library_path: &Path,
    full_prompt: &str,
    attachments: &[ResolvedAssistantAttachment],
    runtime: &AgentRuntimeSettings,
) -> serde_json::Value {
    let mut input = vec![serde_json::json!({
        "type": "text",
        "text": full_prompt,
        "text_elements": [],
    })];
    input.extend(attachments.iter().map(|attachment| match attachment.kind {
        AssistantAttachmentKind::Image => serde_json::json!({
            "type": "localImage",
            "path": attachment.path.display().to_string(),
        }),
        AssistantAttachmentKind::Document => serde_json::json!({
            "type": "mention",
            "name": attachment.name,
            "path": attachment.path.display().to_string(),
        }),
    }));
    serde_json::json!({
        "jsonrpc": "2.0",
        "id": request_id,
        "method": "turn/start",
        "params": {
            "threadId": thread_id,
            "input": input,
            "cwd": library_path.display().to_string(),
            "model": normalized_runtime_model(runtime),
            "serviceTier": runtime_service_tier(runtime),
            "effort": normalized_runtime_effort(runtime),
            "approvalPolicy": runtime_approval_policy(runtime),
            "approvalsReviewer": "user",
        },
    })
}

pub(crate) fn build_app_server_turn_interrupt(
    request_id: u64,
    thread_id: &str,
    turn_id: &str,
) -> serde_json::Value {
    serde_json::json!({
        "jsonrpc": "2.0",
        "id": request_id,
        "method": "turn/interrupt",
        "params": {
            "threadId": thread_id,
            "turnId": turn_id,
        },
    })
}

pub(crate) fn build_app_server_turn_steer(
    request_id: u64,
    thread_id: &str,
    expected_turn_id: &str,
    text: &str,
) -> serde_json::Value {
    serde_json::json!({
        "jsonrpc": "2.0",
        "id": request_id,
        "method": "turn/steer",
        "params": {
            "threadId": thread_id,
            "expectedTurnId": expected_turn_id,
            "input": [{
                "type": "text",
                "text": text,
                "text_elements": [],
            }],
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

fn loby_thread_config(runtime: &AgentRuntimeSettings) -> serde_json::Value {
    let plugins_enabled = runtime.use_plugin_capabilities;
    serde_json::json!({
        "features": {
            "apps": plugins_enabled,
            "memories": false,
            "multi_agent": false,
            "plugins": plugins_enabled,
        },
        "skills": {
            "include_instructions": false,
        },
        "include_apps_instructions": plugins_enabled,
        "include_collaboration_mode_instructions": false,
    })
}

fn runtime_service_tier(runtime: &AgentRuntimeSettings) -> &'static str {
    if runtime.quick_mode {
        "priority"
    } else {
        "default"
    }
}

fn runtime_approval_policy(runtime: &AgentRuntimeSettings) -> &'static str {
    if runtime.execution_mode == "autonomous-read" {
        "never"
    } else {
        "on-request"
    }
}

fn runtime_sandbox(runtime: &AgentRuntimeSettings) -> &'static str {
    if runtime.execution_mode == "autonomous-read" {
        "read-only"
    } else {
        "workspace-write"
    }
}
