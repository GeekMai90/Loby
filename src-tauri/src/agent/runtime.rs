//! [INPUT]: 依赖 Provider 增量流、结构化历史消息、文稿提案、受管附件、Skill、运行 checkpoint、事件桥与 Tauri async runtime
//! [OUTPUT]: 向 crate 提供 AgentApprovalState、AgentRunState 与带权威 phase/item、崩溃恢复日志的流式模型/工具/提案/取消/审批命令
//! [POS]: Loby-owned Agent Runtime 核心，唯一拥有运行状态与工具生命周期；renderer 只投影事件，重启后也不能自动重放副作用
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use super::assistant_attachments::{
    resolve_ai_attachments, AssistantAttachmentState, ResolvedAssistantAttachment,
};
use super::events::{
    emit_agent_activity, emit_agent_message, emit_agent_metric, emit_agent_run_state,
    emit_agent_stream_event, emit_agent_usage, AgentActivity,
};
use super::proposals;
use super::providers::{self, ProviderToolResult};
use super::runtime_events::{complete_active_reasoning, provider_stream_sink};
use super::runtime_tools::{emit_document_proposals, execute_tool_calls, CANCELLED_TOOL_CALL};
use super::tools;
use crate::models::{
    AgentActivityKind, AgentActivityState, AgentActivityVisibility, AgentChatResult,
    AgentConversationMessage, AgentRunPhase, AgentRuntimeSettings,
};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Instant;
use tauri::Manager;
use tokio::sync::{mpsc as tokio_mpsc, watch};

#[derive(Clone, Default)]
pub(crate) struct AgentApprovalState {
    pub(super) pending: Arc<Mutex<HashMap<String, tokio::sync::oneshot::Sender<String>>>>,
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

pub(super) struct AgentStreamRun {
    pub(super) window: tauri::Window,
    pub(super) request_id: String,
    pub(super) provider: String,
    pub(super) library_path: PathBuf,
    pub(super) conversation_id: String,
    pub(super) prompt: String,
    context: String,
    conversation_messages: Vec<AgentConversationMessage>,
    attachments: Vec<ResolvedAssistantAttachment>,
    pub(super) runtime: AgentRuntimeSettings,
    pub(super) approval_state: AgentApprovalState,
    pub(super) cancel_receiver: watch::Receiver<bool>,
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
    conversation_messages: Vec<AgentConversationMessage>,
    attachment_paths: Vec<String>,
    runtime: Option<AgentRuntimeSettings>,
) -> Result<AgentChatResult, String> {
    let provider = providers::normalize_provider(&provider)?;
    let library_path = canonical_library(&path)?;
    let attachments =
        resolve_ai_attachments(attachment_state.inner(), &library_path, &attachment_paths)?;
    let runtime = runtime.unwrap_or_default();
    let system = build_agent_system_prompt(&app, &library_path);
    let prompt = build_agent_prompt(&prompt, &context, &library_path);
    let output = providers::complete(
        &provider,
        &system,
        &prompt,
        &conversation_messages,
        &attachments,
        &runtime,
    )
    .await?;
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
    conversation_messages: Vec<AgentConversationMessage>,
    conversation_id: String,
    attachment_paths: Vec<String>,
    runtime: Option<AgentRuntimeSettings>,
) -> Result<(), String> {
    validate_request_id(&request_id)?;
    let provider = providers::normalize_provider(&provider)?;
    let library_path = canonical_library(&path)?;
    let attachments =
        resolve_ai_attachments(attachment_state.inner(), &library_path, &attachment_paths)?;
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
            conversation_id,
            prompt,
            context,
            conversation_messages,
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

async fn run_agent_chat_stream(run: AgentStreamRun) {
    let library_path = run.library_path.clone();
    let request_id = run.request_id.clone();
    let _ = super::run_checkpoint::write_run_checkpoint(
        super::run_checkpoint::AgentRunCheckpointUpdate {
            library_path: &library_path,
            request_id: &request_id,
            conversation_id: &run.conversation_id,
            provider: &run.provider,
            prompt: &run.prompt,
            status: "running",
            tool_name: "",
            reason: "上次任务在应用关闭前没有完成；只会在你明确确认后重试。",
        },
    );
    run_agent_chat_stream_inner(run).await;
    let _ = super::run_checkpoint::remove_run_checkpoint(&library_path, &request_id);
}

async fn run_agent_chat_stream_inner(mut run: AgentStreamRun) {
    let started_at = Instant::now();
    emit_agent_stream_event(&run.window, &run.request_id, "started", "", "");
    emit_agent_run_state(
        &run.window,
        &run.request_id,
        AgentRunPhase::WaitingForModel,
        None,
    );
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
    tool_definitions.extend(proposals::definitions());
    let (mcp_tools, mcp_errors) = super::mcp::available_mcp_tools().await;
    tool_definitions.extend(mcp_tools);
    for (index, error) in mcp_errors.iter().enumerate() {
        emit_agent_activity(
            &run.window,
            &run.request_id,
            AgentActivity::new(
                format!("mcp-discovery-{index}"),
                AgentActivityKind::Status,
                AgentActivityState::Failed,
                AgentActivityVisibility::Diagnostic,
            )
            .title("MCP server 暂不可用")
            .text(error),
        );
    }
    let mut provider_state = None;
    let mut tool_results = Vec::<ProviderToolResult>::new();

    for step in 0..8 {
        emit_agent_run_state(
            &run.window,
            &run.request_id,
            AgentRunPhase::WaitingForModel,
            None,
        );
        let request_started = Instant::now();
        let request_prompt = prompt.clone();
        let request_provider = run.provider.clone();
        let request_system = system.clone();
        let request_attachments = run.attachments.clone();
        let request_conversation_messages = run.conversation_messages.clone();
        let request_runtime = run.runtime.clone();
        let request_tools = tool_definitions.clone();
        let request_state = provider_state.clone();
        let request_tool_results = tool_results.clone();
        let first_text_delta = Arc::new(AtomicBool::new(false));
        let reasoning_active = Arc::new(AtomicBool::new(false));
        let stream_sink = provider_stream_sink(
            run.window.clone(),
            run.request_id.clone(),
            step,
            request_started,
            Arc::clone(&first_text_delta),
            Arc::clone(&reasoning_active),
        );
        let completion = async move {
            providers::complete_turn(
                &request_provider,
                &request_system,
                &request_prompt,
                &request_conversation_messages,
                &request_attachments,
                &request_runtime,
                &request_tools,
                request_state.as_ref(),
                &request_tool_results,
                &stream_sink,
            )
            .await
        };
        tokio::pin!(completion);
        let result = tokio::select! {
            result = &mut completion => Some(result),
            changed = run.cancel_receiver.changed() => {
                if changed.is_ok() && *run.cancel_receiver.borrow() {
                    complete_active_reasoning(
                        &run.window,
                        &run.request_id,
                        reasoning_active.as_ref(),
                        AgentActivityState::Cancelled,
                    );
                    emit_agent_run_state(&run.window, &run.request_id, AgentRunPhase::Cancelled, None);
                    emit_agent_stream_event(&run.window, &run.request_id, "cancelled", "已取消本次请求。", "");
                    return;
                }
                None
            }
            steering = run.steer_receiver.recv() => {
                if let Some(steering) = steering {
                    complete_active_reasoning(
                        &run.window,
                        &run.request_id,
                        reasoning_active.as_ref(),
                        AgentActivityState::Cancelled,
                    );
                    prompt.push_str("\n\n用户在运行中补充要求：\n");
                    prompt.push_str(&steering);
                    provider_state = None;
                    tool_results.clear();
                    emit_agent_activity(
                        &run.window,
                        &run.request_id,
                        AgentActivity::new(
                            format!("steering-{step}"),
                            AgentActivityKind::Status,
                            AgentActivityState::Completed,
                            AgentActivityVisibility::Diagnostic,
                        )
                        .title("已更新要求，重新请求模型"),
                    );
                    emit_agent_run_state(&run.window, &run.request_id, AgentRunPhase::WaitingForModel, None);
                }
                None
            }
        };
        let Some(result) = result else {
            continue;
        };
        complete_active_reasoning(
            &run.window,
            &run.request_id,
            reasoning_active.as_ref(),
            if result.is_ok() {
                AgentActivityState::Completed
            } else {
                AgentActivityState::Failed
            },
        );
        match result {
            Ok(turn) => {
                emit_agent_usage(&run.window, &run.request_id, turn.usage);
                if turn.tool_calls.is_empty() {
                    if turn.text.trim().is_empty() {
                        emit_agent_run_state(
                            &run.window,
                            &run.request_id,
                            AgentRunPhase::Failed,
                            None,
                        );
                        emit_agent_stream_event(
                            &run.window,
                            &run.request_id,
                            "error",
                            "",
                            "模型没有返回可见文字或工具调用。",
                        );
                        return;
                    }
                    finish_completion(
                        &run,
                        &turn.text,
                        request_started,
                        started_at,
                        first_text_delta.load(Ordering::Relaxed),
                    );
                    return;
                }
                if !turn.text.trim().is_empty() {
                    emit_agent_activity(
                        &run.window,
                        &run.request_id,
                        AgentActivity::new(
                            format!("model-note-{step}"),
                            AgentActivityKind::Status,
                            AgentActivityState::Completed,
                            AgentActivityVisibility::Diagnostic,
                        )
                        .title("模型准备调用工具")
                        .text(&turn.text),
                    );
                }
                provider_state = Some(turn.state);
                if turn
                    .tool_calls
                    .iter()
                    .all(|call| proposals::is_proposal_tool(&call.name))
                {
                    match emit_document_proposals(&run, &turn.tool_calls) {
                        Ok(()) => {
                            let completion_text = if turn.text.trim().is_empty() {
                                "已生成文稿操作建议，请确认后执行。"
                            } else {
                                &turn.text
                            };
                            finish_completion(
                                &run,
                                completion_text,
                                request_started,
                                started_at,
                                first_text_delta.load(Ordering::Relaxed),
                            );
                            return;
                        }
                        Err(results) => {
                            tool_results = results;
                            continue;
                        }
                    }
                }
                tool_results =
                    match execute_tool_calls(&mut run, &tool_definitions, turn.tool_calls).await {
                        Ok(results) => results,
                        Err(error) if error == CANCELLED_TOOL_CALL => {
                            emit_agent_run_state(
                                &run.window,
                                &run.request_id,
                                AgentRunPhase::Cancelled,
                                None,
                            );
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
                            emit_agent_run_state(
                                &run.window,
                                &run.request_id,
                                AgentRunPhase::Failed,
                                None,
                            );
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
                emit_agent_run_state(&run.window, &run.request_id, AgentRunPhase::Failed, None);
                emit_agent_stream_event(&run.window, &run.request_id, "error", "", &error);
                return;
            }
        }
    }
    emit_agent_run_state(&run.window, &run.request_id, AgentRunPhase::Failed, None);
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
    first_text_delta_emitted: bool,
) {
    emit_agent_run_state(
        &run.window,
        &run.request_id,
        AgentRunPhase::Finalizing,
        None,
    );
    if !first_text_delta_emitted {
        emit_agent_metric(
            &run.window,
            &run.request_id,
            "first_text_delta",
            "ready",
            request_started.elapsed().as_millis() as u64,
        );
    }
    emit_agent_message(&run.window, &run.request_id, text);
    emit_agent_metric(
        &run.window,
        &run.request_id,
        "completed",
        "completed",
        started_at.elapsed().as_millis() as u64,
    );
    emit_agent_run_state(&run.window, &run.request_id, AgentRunPhase::Completed, None);
    emit_agent_stream_event(&run.window, &run.request_id, "done", "", "");
}

fn build_agent_system_prompt(app: &tauri::AppHandle, library_path: &std::path::Path) -> String {
    let catalog = super::skill_store::catalog_for_prompt(app, library_path);
    [
        "你是落笔（Loby）写作软件里的 AI 写作助手。",
        "辅助人类写作，不要用一键整篇代写替代作者。",
        "运行过程摘要（reasoning summary）必须使用简体中文纯文本，即使正文目标语言不是中文；不要使用 Markdown 标记或英文标题。",
        "优先给出可审阅的建议、结构调整、局部润色和发布准备。",
        "未经用户确认，不要声称已经覆盖、删除、移动或发布任何本地内容。",
        "只有 Loby 明确提供的工具可以执行；工具结果不等于正文已经修改。",
        "用户明确要求插入、创建、导出或修改正文时，必须调用对应的 propose_* 工具生成结构化确认卡片；不要用代码块伪造工具调用。",
        "propose_* 工具只提出建议，不会直接写入正文；除非工具调用已经成功返回，否则不要声称已创建确认卡片或完成插入。",
        "普通的一次性任务直接按用户自然语言完成；只有可复用的多步骤工作流才应使用 Skill。",
        "用户要求创建 Skill 时，先通过对话明确实例、边界和步骤；得到确认后调用 create_skill，不要伪称已保存。",
        "用户明确提供单个本地 Skill 路径并要求检查、转换或安装时，先调用 inspect_external_skill；不得猜测路径、遍历父目录或扫描其他客户端的 Skill。用户决定安装后才调用 install_external_skill，待适配包安装后继续用 inspect_skill_package 和 update_skill 完成转换。",
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
