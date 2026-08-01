//! [INPUT]: 依赖 Provider 增量流、结构化历史消息、用户明确的本地参考目录、带运行内定位策略的文稿提案、受管附件、Skill、运行 checkpoint、事件桥与 Tauri async runtime
//! [OUTPUT]: 向 crate 提供稳定的协作写作身份、AgentApprovalState、拒绝重复 requestId 且具备总时限/步数预算的 AgentRunState，以及持久化 checkpoint、保留不确定写入证据、禁止提案位置静默降级且以用户 steer 重建意图的流式命令
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
use super::runtime_tools::{
    emit_document_proposals, execute_tool_calls, CANCELLED_TOOL_CALL, TIMED_OUT_TOOL_CALL,
    UNCERTAIN_WRITE_TOOL_CALL,
};
use super::tools;
use crate::models::{
    AgentActivityKind, AgentActivityState, AgentActivityVisibility, AgentChatResult,
    AgentConversationMessage, AgentRunPhase, AgentRuntimeSettings, AgentStreamEventKind,
};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::Manager;
use tokio::sync::{mpsc as tokio_mpsc, watch};

const MAX_AGENT_STEPS: usize = 12;
const MAX_AUTONOMOUS_READ_AGENT_STEPS: usize = 24;
const MAX_AGENT_RUN_DURATION: Duration = Duration::from_secs(20 * 60);
const BASE_AGENT_SYSTEM_PROMPT: &[&str] = &[
    "你是落笔（Loby）写作软件中的 AI 写作助手，是作者的协作伙伴，而不是作者的替代者。",
    "你的使命是帮助用户澄清想法、改善表达、组织结构、查找资料并完成发布准备，同时始终保留作者对内容的最终控制权。",
    "",
    "工作原则：",
    "- 优先理解用户当前的写作目标、已有稿件和表达风格，再提供帮助。",
    "- 对普通问题直接回答；不要为了展示能力而调用不必要的工具。",
    "- 提供修改建议时，尽量保持作者原有观点、语气和表达习惯，避免无依据地扩写或改变立场。",
    "- 不确定的信息必须明确说明；不要编造事实、来源、文件状态或工具执行结果。",
    "- 默认采用协作式写作；如果用户明确要求完整初稿，可以提供可审阅的草稿，但不要把它表述为已经完成或替代作者最终创作。",
    "",
    "操作边界：",
    "- 未经用户明确要求，不主动修改、创建、移动、删除、导出或发布任何内容。",
    "- 用户明确要求修改正文、插入内容、创建文稿或保存成果时，调用 Loby 提供的对应工具生成可审阅的确认卡片。",
    "- 工具调用只是提出操作或返回结果；只有收到明确的成功结果后，才能说明相应操作已经完成。",
    "- 用户在当前对话中明确提供本地目录时，可以使用 read_local_directory 只读检查其中受支持的文本样式文件；不得猜测或访问其他本地路径。",
    "- 读取外部目录时先列出文件清单，再尽量批量读取必要文件；不要重复调用同一个目录或文件。",
    "- 不使用代码块、自然语言或虚构结果伪造工具调用。",
    "- 只有 Loby 明确提供的工具可以执行。",
    "",
    "运行过程：",
    "- 只向用户展示简短、清晰的简体中文进度摘要。",
    "- 不展示隐藏的完整思维过程、内部推理链、Markdown 标记、英文分析标题或无关技术细节。",
    "",
    "Skill：",
    "- 一次性任务直接完成；只有稳定、可复用的多步骤工作流才考虑使用或创建 Skill。",
    "- Skill 的检查、安装和修改必须遵循 Loby 提供的工具与用户确认流程。",
];

struct AgentLoopBudget {
    max_steps: usize,
    completed_steps: usize,
    attempts: usize,
}

impl Default for AgentLoopBudget {
    fn default() -> Self {
        Self::with_max_steps(MAX_AGENT_STEPS)
    }
}

impl AgentLoopBudget {
    fn has_capacity(&self) -> bool {
        self.completed_steps < self.max_steps
    }

    fn with_max_steps(max_steps: usize) -> Self {
        Self {
            max_steps,
            completed_steps: 0,
            attempts: 0,
        }
    }

    fn begin_attempt(&mut self) -> usize {
        let attempt = self.attempts;
        self.attempts += 1;
        attempt
    }

    fn complete_step(&mut self) -> usize {
        self.completed_steps += 1;
        self.completed_steps
    }
}

fn max_agent_steps(runtime: &AgentRuntimeSettings) -> usize {
    if runtime.execution_mode == "autonomous-read" {
        MAX_AUTONOMOUS_READ_AGENT_STEPS
    } else {
        MAX_AGENT_STEPS
    }
}

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
    pub(super) local_directory_paths: Vec<String>,
    pub(super) approval_state: AgentApprovalState,
    pub(super) cancel_receiver: watch::Receiver<bool>,
    pub(super) uncertain_write: Arc<AtomicBool>,
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
    local_directory_paths: Vec<String>,
    runtime: Option<AgentRuntimeSettings>,
    supersedes_request_id: Option<String>,
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
    register_run_control(
        &run_state,
        &request_id,
        AgentRunControl {
            cancel_sender,
            steer_sender,
        },
    )?;

    if let Err(error) = super::run_checkpoint::write_run_checkpoint_replacing(
        super::run_checkpoint::AgentRunCheckpointUpdate {
            library_path: &library_path,
            request_id: &request_id,
            conversation_id: &conversation_id,
            provider: &provider,
            prompt: &prompt,
            status: "running",
            tool_name: "",
            reason: "上次任务在应用关闭前没有完成；只会在你明确确认后重试。",
        },
        supersedes_request_id.as_deref(),
    ) {
        if let Ok(mut pending) = run_state.pending.lock() {
            pending.remove(&request_id);
        }
        return Err(error);
    }

    tauri::async_runtime::spawn(async move {
        let cleanup_state = run_state.clone();
        let cleanup_request_id = request_id.clone();
        let cleanup_library_path = library_path.clone();
        let uncertain_write = Arc::new(AtomicBool::new(false));
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
            local_directory_paths,
            approval_state,
            cancel_receiver,
            uncertain_write: Arc::clone(&uncertain_write),
            steer_receiver,
        })
        .await;
        if !uncertain_write.load(Ordering::Acquire) {
            let _ = super::run_checkpoint::remove_run_checkpoint(
                &cleanup_library_path,
                &cleanup_request_id,
            );
        }
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
    run_agent_chat_stream_inner(run).await;
}

async fn run_agent_chat_stream_inner(mut run: AgentStreamRun) {
    let started_at = Instant::now();
    let run_deadline = tokio::time::Instant::now() + MAX_AGENT_RUN_DURATION;
    emit_agent_stream_event(
        &run.window,
        &run.request_id,
        AgentStreamEventKind::Started,
        "",
        "",
    );
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
    let mcp_discovery = super::mcp::available_mcp_tools();
    tokio::pin!(mcp_discovery);
    let (mcp_tools, mcp_errors) = tokio::select! {
        result = &mut mcp_discovery => result,
        changed = run.cancel_receiver.changed() => {
            if changed.is_ok() && *run.cancel_receiver.borrow() {
                finish_cancelled(&run);
                return;
            }
            (Vec::new(), vec!["MCP 工具发现通道已关闭。".to_string()])
        }
        _ = tokio::time::sleep_until(run_deadline) => {
            finish_timed_out(&run);
            return;
        }
    };
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
    let mut proposal_policy = proposals::ProposalRunPolicy::default();

    let mut budget = AgentLoopBudget::with_max_steps(max_agent_steps(&run.runtime));
    while budget.has_capacity() {
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
        let stream_attempt = budget.begin_attempt();
        let stream_sink = provider_stream_sink(
            run.window.clone(),
            run.request_id.clone(),
            stream_attempt,
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
                    finish_cancelled(&run);
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
                    proposal_policy.reset();
                    emit_agent_activity(
                        &run.window,
                        &run.request_id,
                        AgentActivity::new(
                            format!("steering-{stream_attempt}"),
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
            _ = tokio::time::sleep_until(run_deadline) => {
                complete_active_reasoning(
                    &run.window,
                    &run.request_id,
                    reasoning_active.as_ref(),
                    AgentActivityState::Failed,
                );
                finish_timed_out(&run);
                return;
            }
        };
        let Some(result) = result else {
            continue;
        };
        let step = budget.complete_step();
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
                            AgentStreamEventKind::Error,
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
                    tool_results =
                        emit_document_proposals(&run, &turn.tool_calls, &mut proposal_policy);
                    continue;
                }
                tool_results = match execute_tool_calls(
                    &mut run,
                    &tool_definitions,
                    turn.tool_calls,
                    run_deadline,
                )
                .await
                {
                    Ok(results) => results,
                    Err(error) if error == CANCELLED_TOOL_CALL => {
                        finish_cancelled(&run);
                        return;
                    }
                    Err(error) if error == TIMED_OUT_TOOL_CALL => {
                        finish_timed_out(&run);
                        return;
                    }
                    Err(error) if error == UNCERTAIN_WRITE_TOOL_CALL => {
                        finish_uncertain_write(&run);
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
                            AgentStreamEventKind::Error,
                            "",
                            &error,
                        );
                        return;
                    }
                };
            }
            Err(error) => {
                emit_agent_run_state(&run.window, &run.request_id, AgentRunPhase::Failed, None);
                emit_agent_stream_event(
                    &run.window,
                    &run.request_id,
                    AgentStreamEventKind::Error,
                    "",
                    &error,
                );
                return;
            }
        }
    }
    emit_agent_run_state(&run.window, &run.request_id, AgentRunPhase::Failed, None);
    emit_agent_stream_event(
        &run.window,
        &run.request_id,
        AgentStreamEventKind::Error,
        "",
        &format!(
            "本轮模型与工具循环已达到 {} 步上限，请缩小任务范围后重试。",
            budget.max_steps
        ),
    );
}

fn finish_cancelled(run: &AgentStreamRun) {
    emit_agent_run_state(&run.window, &run.request_id, AgentRunPhase::Cancelled, None);
    emit_agent_stream_event(
        &run.window,
        &run.request_id,
        AgentStreamEventKind::Cancelled,
        if run.uncertain_write.load(Ordering::Acquire) {
            "已停止本次请求；外部写入可能已经发生，请先检查目标状态再决定是否重试。"
        } else {
            "已取消本次请求。"
        },
        "",
    );
}

fn finish_timed_out(run: &AgentStreamRun) {
    emit_agent_run_state(&run.window, &run.request_id, AgentRunPhase::Failed, None);
    emit_agent_stream_event(
        &run.window,
        &run.request_id,
        AgentStreamEventKind::Error,
        "",
        if run.uncertain_write.load(Ordering::Acquire) {
            "本次 AI 任务已运行 20 分钟并停止；外部写入结果不确定，请先检查目标状态再决定是否重试。"
        } else {
            "本次 AI 任务已运行 20 分钟并安全停止。请缩小任务范围后重试。"
        },
    );
}

fn finish_uncertain_write(run: &AgentStreamRun) {
    emit_agent_run_state(&run.window, &run.request_id, AgentRunPhase::Failed, None);
    emit_agent_stream_event(
        &run.window,
        &run.request_id,
        AgentStreamEventKind::Error,
        "",
        "外部写入工具等待超过 6 分钟，结果可能已经生效。请先检查目标状态再决定是否重试。",
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
    emit_agent_stream_event(
        &run.window,
        &run.request_id,
        AgentStreamEventKind::Done,
        "",
        "",
    );
}

fn build_agent_system_prompt(app: &tauri::AppHandle, library_path: &std::path::Path) -> String {
    let catalog = super::skill_store::catalog_for_prompt(app, library_path);
    let base = BASE_AGENT_SYSTEM_PROMPT.join("\n");
    if catalog.trim().is_empty() {
        base
    } else {
        format!("{base}\n\n{catalog}")
    }
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

fn register_run_control(
    state: &AgentRunState,
    request_id: &str,
    control: AgentRunControl,
) -> Result<(), String> {
    let mut pending = state.pending.lock().map_err(|error| error.to_string())?;
    if pending.contains_key(request_id) {
        return Err("相同的 AI 请求已经在运行。".to_string());
    }
    pending.insert(request_id.to_string(), control);
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
#[path = "runtime_tests.rs"]
mod tests;
