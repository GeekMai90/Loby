//! [INPUT]: 依赖 Provider、credential、attachments、Skill catalog、稳定事件桥与 Tauri async runtime
//! [OUTPUT]: 向 crate 提供 AgentApprovalState、AgentRunState 与支持渐进式 Skill 激活的模型调用、请求级 stream、取消、引导和审批命令
//! [POS]: Loby-owned Agent Runtime 核心，拥有运行生命周期但不拥有对话持久化或 Markdown 写入
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use super::assistant_attachments::{
    resolve_ai_attachments, AssistantAttachmentState, ResolvedAssistantAttachment,
};
use super::events::{
    emit_agent_activity, emit_agent_approval, emit_agent_message, emit_agent_metric,
    emit_agent_stream_event, emit_agent_usage,
};
use super::providers::{self, ProviderToolResult};
use super::tools::{self, ToolDefinition};
use crate::models::{AgentChatResult, AgentRuntimeSettings};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Instant;
use tauri::Manager;
use tokio::sync::{mpsc as tokio_mpsc, watch};

const CANCELLED_TOOL_CALL: &str = "__loby_cancelled_tool_call__";

#[derive(Clone, Default)]
pub(crate) struct AgentApprovalState {
    pending: Arc<Mutex<HashMap<String, tokio::sync::oneshot::Sender<String>>>>,
}

#[derive(Clone, Default)]
pub(crate) struct AgentRunState {
    pending: Arc<Mutex<HashMap<String, AgentRunControl>>>,
}

#[derive(Clone)]
struct AgentRunControl {
    cancel_sender: watch::Sender<bool>,
    steer_sender: tokio_mpsc::UnboundedSender<String>,
}

struct AgentStreamRun {
    window: tauri::Window,
    request_id: String,
    provider: String,
    library_path: PathBuf,
    prompt: String,
    context: String,
    attachments: Vec<ResolvedAssistantAttachment>,
    runtime: AgentRuntimeSettings,
    approval_state: AgentApprovalState,
    cancel_receiver: watch::Receiver<bool>,
    steer_receiver: tokio_mpsc::UnboundedReceiver<String>,
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub(crate) async fn run_agent_chat(
    app: tauri::AppHandle,
    attachment_state: tauri::State<'_, AssistantAttachmentState>,
    path: String,
    provider: String,
    prompt: String,
    context: String,
    attachment_paths: Vec<String>,
    runtime: Option<AgentRuntimeSettings>,
) -> Result<AgentChatResult, String> {
    let provider = providers::normalize_provider(&provider)?;
    let library_path = canonical_library(&path)?;
    let attachments = resolve_ai_attachments(attachment_state.inner(), &attachment_paths)?;
    let runtime = runtime.unwrap_or_default();
    let system = build_agent_system_prompt(&app, &library_path);
    let prompt = build_agent_prompt(&prompt, &context, &library_path);
    let output = providers::complete(&provider, &system, &prompt, &attachments, &runtime).await?;
    Ok(AgentChatResult {
        output,
        error: String::new(),
        command: provider,
    })
}

#[tauri::command]
pub(crate) async fn prewarm_agent_runtime(provider: String) -> Result<(), String> {
    providers::normalize_provider(&provider).map(|_| ())
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub(crate) fn start_agent_chat_stream(
    window: tauri::Window,
    attachment_state: tauri::State<AssistantAttachmentState>,
    approval_state: tauri::State<AgentApprovalState>,
    run_state: tauri::State<AgentRunState>,
    request_id: String,
    path: String,
    provider: String,
    prompt: String,
    context: String,
    attachment_paths: Vec<String>,
    runtime: Option<AgentRuntimeSettings>,
) -> Result<(), String> {
    validate_request_id(&request_id)?;
    let provider = providers::normalize_provider(&provider)?;
    let library_path = canonical_library(&path)?;
    let attachments = resolve_ai_attachments(attachment_state.inner(), &attachment_paths)?;
    let run_state = run_state.inner().clone();
    let approval_state = approval_state.inner().clone();
    let (cancel_sender, cancel_receiver) = watch::channel(false);
    let (steer_sender, steer_receiver) = tokio_mpsc::unbounded_channel();
    run_state
        .pending
        .lock()
        .map_err(|error| error.to_string())?
        .insert(
            request_id.clone(),
            AgentRunControl {
                cancel_sender,
                steer_sender,
            },
        );

    tauri::async_runtime::spawn(async move {
        let cleanup_state = run_state.clone();
        let cleanup_request_id = request_id.clone();
        run_agent_chat_stream(AgentStreamRun {
            window,
            request_id,
            provider,
            library_path,
            prompt,
            context,
            attachments,
            runtime: runtime.unwrap_or_default(),
            approval_state,
            cancel_receiver,
            steer_receiver,
        })
        .await;
        if let Ok(mut pending) = cleanup_state.pending.lock() {
            pending.remove(&cleanup_request_id);
        };
    });
    Ok(())
}

#[tauri::command]
pub(crate) fn cancel_agent_chat_stream(
    request_id: String,
    run_state: tauri::State<AgentRunState>,
    approval_state: tauri::State<AgentApprovalState>,
) -> Result<(), String> {
    let control = run_state
        .pending
        .lock()
        .map_err(|error| error.to_string())?
        .remove(&request_id);
    if let Some(control) = control {
        let _ = control.cancel_sender.send(true);
    }
    cancel_pending_approvals(&request_id, approval_state.inner())?;
    Ok(())
}

#[tauri::command]
pub(crate) fn steer_agent_chat_stream(
    request_id: String,
    text: String,
    run_state: tauri::State<AgentRunState>,
) -> Result<(), String> {
    let text = text.trim();
    if text.is_empty() {
        return Err("引导内容不能为空。".to_string());
    }
    let sender = run_state
        .pending
        .lock()
        .map_err(|error| error.to_string())?
        .get(&request_id)
        .map(|control| control.steer_sender.clone())
        .ok_or_else(|| "当前 AI 任务已经结束，无法继续引导。".to_string())?;
    sender
        .send(text.to_string())
        .map_err(|_| "当前 AI 任务已经结束，无法继续引导。".to_string())
}

#[tauri::command]
pub(crate) fn respond_agent_approval(
    approval_id: String,
    decision: String,
    approval_state: tauri::State<AgentApprovalState>,
) -> Result<(), String> {
    let sender = approval_state
        .pending
        .lock()
        .map_err(|error| error.to_string())?
        .remove(&approval_id);
    if let Some(sender) = sender {
        sender
            .send(decision)
            .map_err(|_| "当前审批已经结束。".to_string())?;
    }
    Ok(())
}

async fn run_agent_chat_stream(mut run: AgentStreamRun) {
    let started_at = Instant::now();
    emit_agent_stream_event(&run.window, &run.request_id, "started", "", "");
    emit_agent_metric(
        &run.window,
        &run.request_id,
        "runtime_ready",
        "ready",
        started_at.elapsed().as_millis() as u64,
    );
    let system = build_agent_system_prompt(run.window.app_handle(), &run.library_path);
    let mut prompt = build_agent_prompt(&run.prompt, &run.context, &run.library_path);
    let mut tool_definitions = tools::builtin_tool_definitions();
    let (mcp_tools, mcp_errors) = super::mcp::available_mcp_tools().await;
    tool_definitions.extend(mcp_tools);
    for (index, error) in mcp_errors.iter().enumerate() {
        emit_agent_activity(
            &run.window,
            &run.request_id,
            &format!("mcp-discovery-{index}"),
            "MCP server 暂不可用",
            "failed",
            error,
            None,
        );
    }
    let mut provider_state = None;
    let mut tool_results = Vec::<ProviderToolResult>::new();

    for step in 0..8 {
        emit_agent_activity(
            &run.window,
            &run.request_id,
            "provider-request",
            "请求模型",
            "in_progress",
            "",
            None,
        );
        let request_started = Instant::now();
        let request_prompt = prompt.clone();
        let request_provider = run.provider.clone();
        let request_system = system.clone();
        let request_attachments = run.attachments.clone();
        let request_runtime = run.runtime.clone();
        let request_tools = tool_definitions.clone();
        let request_state = provider_state.clone();
        let request_tool_results = tool_results.clone();
        let completion = async move {
            providers::complete_turn(
                &request_provider,
                &request_system,
                &request_prompt,
                &request_attachments,
                &request_runtime,
                &request_tools,
                request_state.as_ref(),
                &request_tool_results,
            )
            .await
        };
        tokio::pin!(completion);
        let result = tokio::select! {
            result = &mut completion => Some(result),
            changed = run.cancel_receiver.changed() => {
                if changed.is_ok() && *run.cancel_receiver.borrow() {
                    emit_agent_stream_event(&run.window, &run.request_id, "cancelled", "已取消本次请求。", "");
                    return;
                }
                None
            }
            steering = run.steer_receiver.recv() => {
                if let Some(steering) = steering {
                    prompt.push_str("\n\n用户在运行中补充要求：\n");
                    prompt.push_str(&steering);
                    provider_state = None;
                    tool_results.clear();
                    emit_agent_activity(
                        &run.window,
                        &run.request_id,
                        "provider-request",
                        "已更新要求，重新请求模型",
                        "in_progress",
                        "",
                        None,
                    );
                }
                None
            }
        };
        let Some(result) = result else {
            continue;
        };
        match result {
            Ok(turn) => {
                emit_agent_usage(&run.window, &run.request_id, turn.usage);
                if turn.tool_calls.is_empty() {
                    if turn.text.trim().is_empty() {
                        emit_agent_stream_event(
                            &run.window,
                            &run.request_id,
                            "error",
                            "",
                            "模型没有返回可见文字或工具调用。",
                        );
                        return;
                    }
                    finish_completion(&run, &turn.text, request_started, started_at);
                    return;
                }
                if !turn.text.trim().is_empty() {
                    emit_agent_activity(
                        &run.window,
                        &run.request_id,
                        &format!("model-note-{step}"),
                        "模型准备调用工具",
                        "completed",
                        &turn.text,
                        None,
                    );
                }
                provider_state = Some(turn.state);
                tool_results =
                    match execute_tool_calls(&mut run, &tool_definitions, turn.tool_calls).await {
                        Ok(results) => results,
                        Err(error) if error == CANCELLED_TOOL_CALL => {
                            emit_agent_stream_event(
                                &run.window,
                                &run.request_id,
                                "cancelled",
                                "已取消本次请求。",
                                "",
                            );
                            return;
                        }
                        Err(error) => {
                            emit_agent_stream_event(
                                &run.window,
                                &run.request_id,
                                "error",
                                "",
                                &error,
                            );
                            return;
                        }
                    };
            }
            Err(error) => {
                emit_agent_activity(
                    &run.window,
                    &run.request_id,
                    "provider-request",
                    "模型请求失败",
                    "failed",
                    "",
                    None,
                );
                emit_agent_stream_event(&run.window, &run.request_id, "error", "", &error);
                return;
            }
        }
    }
    emit_agent_stream_event(
        &run.window,
        &run.request_id,
        "error",
        "",
        "本轮工具调用已达到 8 步上限，请缩小任务范围后重试。",
    );
}

fn finish_completion(
    run: &AgentStreamRun,
    text: &str,
    request_started: Instant,
    started_at: Instant,
) {
    emit_agent_activity(
        &run.window,
        &run.request_id,
        "provider-request",
        "模型回复完成",
        "completed",
        "",
        None,
    );
    emit_agent_metric(
        &run.window,
        &run.request_id,
        "first_text_delta",
        "ready",
        request_started.elapsed().as_millis() as u64,
    );
    emit_agent_message(&run.window, &run.request_id, text);
    emit_agent_metric(
        &run.window,
        &run.request_id,
        "completed",
        "completed",
        started_at.elapsed().as_millis() as u64,
    );
    emit_agent_stream_event(&run.window, &run.request_id, "done", "", "");
}

async fn execute_tool_calls(
    run: &mut AgentStreamRun,
    definitions: &[ToolDefinition],
    calls: Vec<providers::ProviderToolCall>,
) -> Result<Vec<ProviderToolResult>, String> {
    let mut results = Vec::with_capacity(calls.len());
    for call in calls {
        let definition = definitions
            .iter()
            .find(|definition| definition.name == call.name)
            .ok_or_else(|| format!("模型请求了未注册工具：{}", call.name))?;
        let item_id = format!("tool-{}", call.id);
        if definition.effect == "write" {
            let approved = request_tool_approval(run, &item_id, definition).await?;
            if !approved {
                results.push(ProviderToolResult {
                    call_id: call.id,
                    output: "用户拒绝了这次工具调用。".to_string(),
                });
                continue;
            }
        }
        emit_agent_activity(
            &run.window,
            &run.request_id,
            &item_id,
            &format!("调用 {}", definition.name),
            "in_progress",
            "",
            None,
        );
        let execution = async {
            if definition.name.starts_with("mcp__") {
                super::mcp::execute_namespaced_mcp_tool(&definition.name, &call.arguments).await
            } else {
                tools::execute_builtin_tool(
                    run.window.app_handle(),
                    &run.library_path,
                    &definition.name,
                    &call.arguments,
                )
                .await
            }
        };
        tokio::pin!(execution);
        let execution = tokio::select! {
            result = &mut execution => result,
            changed = run.cancel_receiver.changed() => {
                if changed.is_ok() && *run.cancel_receiver.borrow() {
                    return Err(CANCELLED_TOOL_CALL.to_string());
                }
                continue;
            }
        };
        match execution {
            Ok(execution) => {
                emit_agent_activity(
                    &run.window,
                    &run.request_id,
                    &item_id,
                    &format!("完成 {}", definition.name),
                    "completed",
                    "",
                    execution.artifact_path.as_deref(),
                );
                results.push(ProviderToolResult {
                    call_id: call.id,
                    output: truncate_tool_output(execution.output),
                });
            }
            Err(error) => {
                emit_agent_activity(
                    &run.window,
                    &run.request_id,
                    &item_id,
                    &format!("{} 调用失败", definition.name),
                    "failed",
                    &error,
                    None,
                );
                results.push(ProviderToolResult {
                    call_id: call.id,
                    output: format!("工具调用失败：{error}"),
                });
            }
        }
    }
    Ok(results)
}

async fn request_tool_approval(
    run: &mut AgentStreamRun,
    approval_id: &str,
    definition: &ToolDefinition,
) -> Result<bool, String> {
    if run.runtime.execution_mode == "autonomous-read" {
        return Ok(false);
    }
    let approval_id = format!("{}:{}", run.request_id, approval_id);
    let (sender, receiver) = tokio::sync::oneshot::channel();
    run.approval_state
        .pending
        .lock()
        .map_err(|error| error.to_string())?
        .insert(approval_id.clone(), sender);
    emit_agent_approval(
        &run.window,
        &run.request_id,
        &approval_id,
        "需要工具审批",
        &format!("{} 可能修改外部状态，是否允许本次调用？", definition.name),
    );
    tokio::select! {
        decision = receiver => Ok(matches!(decision.as_deref(), Ok("accept" | "acceptForSession"))),
        changed = run.cancel_receiver.changed() => {
            if changed.is_ok() && *run.cancel_receiver.borrow() {
                Err(CANCELLED_TOOL_CALL.to_string())
            } else {
                Ok(false)
            }
        }
    }
}

fn truncate_tool_output(output: String) -> String {
    const LIMIT: usize = 64 * 1024;
    if output.len() <= LIMIT {
        return output;
    }
    let mut end = LIMIT;
    while !output.is_char_boundary(end) {
        end -= 1;
    }
    format!("{}\n\n[工具结果已截断]", &output[..end])
}

fn build_agent_system_prompt(app: &tauri::AppHandle, library_path: &std::path::Path) -> String {
    let catalog = super::skill_store::catalog_for_prompt(app, library_path);
    [
        "你是落笔（Loby）写作软件里的 AI 写作助手。",
        "辅助人类写作，不要用一键整篇代写替代作者。",
        "优先给出可审阅的建议、结构调整、局部润色和发布准备。",
        "未经用户确认，不要声称已经覆盖、删除、移动或发布任何本地内容。",
        "只有 Loby 明确提供的工具可以执行；工具结果不等于正文已经修改。",
        "普通的一次性任务直接按用户自然语言完成；只有可复用的多步骤工作流才应使用 Skill。",
        "用户要求创建 Skill 时，先通过对话明确实例、边界和步骤；得到确认后调用 create_skill，不要伪称已保存。",
        &catalog,
    ]
    .into_iter()
    .filter(|line| !line.is_empty())
    .collect::<Vec<_>>()
    .join("\n")
}

fn build_agent_prompt(prompt: &str, context: &str, library_path: &std::path::Path) -> String {
    format!(
        "当前写作库：{}\n\n当前写作上下文：\n{}\n\n用户消息：\n{}",
        library_path.display(),
        context,
        prompt
    )
}

fn canonical_library(path: &str) -> Result<PathBuf, String> {
    PathBuf::from(path)
        .canonicalize()
        .map_err(|_| "当前写作库路径无效。".to_string())
        .and_then(|path| {
            if path.is_dir() {
                Ok(path)
            } else {
                Err("当前写作库路径不是目录。".to_string())
            }
        })
}

fn validate_request_id(request_id: &str) -> Result<(), String> {
    if request_id.is_empty()
        || request_id.len() > 128
        || !request_id
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_'))
    {
        return Err("AI 请求 ID 无效。".to_string());
    }
    Ok(())
}

fn cancel_pending_approvals(
    request_id: &str,
    approval_state: &AgentApprovalState,
) -> Result<(), String> {
    let prefix = format!("{request_id}:");
    let senders = {
        let mut pending = approval_state
            .pending
            .lock()
            .map_err(|error| error.to_string())?;
        let ids = pending
            .keys()
            .filter(|id| id.starts_with(&prefix))
            .cloned()
            .collect::<Vec<_>>();
        ids.into_iter()
            .filter_map(|id| pending.remove(&id))
            .collect::<Vec<_>>()
    };
    for sender in senders {
        let _ = sender.send("cancel".to_string());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{build_agent_prompt, validate_request_id};
    use std::path::Path;

    #[test]
    fn request_id_is_safe_for_request_scoped_events() {
        assert!(validate_request_id("agent-123_abc").is_ok());
        assert!(validate_request_id("agent/123").is_err());
    }

    #[test]
    fn prompt_keeps_context_and_user_message_separate() {
        let prompt = build_agent_prompt("请分析结构", "当前稿件：测试", Path::new("/tmp/library"));
        assert!(prompt.contains("当前写作上下文：\n当前稿件：测试"));
        assert!(prompt.contains("用户消息：\n请分析结构"));
    }
}
