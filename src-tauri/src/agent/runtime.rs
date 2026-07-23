//! [INPUT]: 依赖 agent app_server 长生命周期状态、attachments/events/process 路径缓存、Codex runtime 模型与并发控制原语
//! [OUTPUT]: 向 crate 提供 AgentApprovalState、AgentRunState 与 runtime 预热、chat stream 启动、取消、引导、审批和兼容 CLI 能力
//! [POS]: 本地 AI agent 领域的 command/runtime 协调层，把面板预热与每轮请求接入共享 Codex transport 或独立兼容 CLI
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use super::app_server::{run_codex_app_server_stream_blocking, CodexAppServerState};
use super::assistant_attachments::{
    resolve_ai_attachments, AssistantAttachmentKind, AssistantAttachmentState,
    ResolvedAssistantAttachment,
};
use super::events::emit_agent_stream_event;
use super::process::{
    agent_binary_name, normalize_agent_provider, run_command_with_timeout, AgentCommandState,
};
use crate::models::{AgentRuntimeSettings, CodexChatResult};
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::{mpsc, Arc, Mutex};
use std::thread;
use std::time::Duration;

#[derive(Clone, Default)]
pub(crate) struct AgentApprovalState {
    pub(super) pending: Arc<Mutex<HashMap<String, mpsc::Sender<String>>>>,
}

#[derive(Clone, Default)]
pub(crate) struct AgentRunState {
    pending: Arc<Mutex<HashMap<String, AgentRunControl>>>,
}

#[derive(Clone)]
struct AgentRunControl {
    cancel_sender: mpsc::Sender<()>,
    steer_sender: mpsc::Sender<String>,
}

pub(super) struct AgentStreamRun {
    pub(super) window: tauri::Window,
    pub(super) request_id: String,
    pub(super) provider: String,
    pub(super) agent_path: String,
    pub(super) library_path: PathBuf,
    pub(super) full_prompt: String,
    pub(super) attachments: Vec<ResolvedAssistantAttachment>,
    pub(super) runtime: AgentRuntimeSettings,
    pub(super) approval_state: AgentApprovalState,
    pub(super) app_server_state: CodexAppServerState,
    pub(super) command_state: AgentCommandState,
    pub(super) thread_id: Option<String>,
    pub(super) cancel_receiver: mpsc::Receiver<()>,
    pub(super) steer_receiver: mpsc::Receiver<String>,
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub(crate) async fn run_agent_chat(
    attachment_state: tauri::State<'_, AssistantAttachmentState>,
    command_state: tauri::State<'_, AgentCommandState>,
    path: String,
    provider: String,
    prompt: String,
    context: String,
    attachment_paths: Vec<String>,
    runtime: Option<AgentRuntimeSettings>,
    cli_path: Option<String>,
) -> Result<CodexChatResult, String> {
    let attachments = resolve_ai_attachments(attachment_state.inner(), &attachment_paths)?;
    let provider = normalize_agent_provider(&provider);
    let command_state = command_state.inner().clone();
    let agent_path = command_state.resolve(&provider, cli_path).ok_or_else(|| {
        format!(
            "Cannot find {} on PATH. Install the CLI or set its path in Loby.",
            agent_binary_name(&provider)
        )
    })?;
    let run_agent_path = agent_path.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        run_agent_chat_blocking(
            path,
            provider,
            prompt,
            context,
            attachments,
            runtime,
            run_agent_path,
        )
    })
    .await
    .map_err(|error| error.to_string())?;
    if result.is_err() {
        command_state.invalidate_path(&agent_path);
    }
    result
}

#[tauri::command]
pub(crate) async fn prewarm_agent_runtime(
    command_state: tauri::State<'_, AgentCommandState>,
    app_server_state: tauri::State<'_, CodexAppServerState>,
    provider: String,
    cli_path: Option<String>,
) -> Result<(), String> {
    let command_state = command_state.inner().clone();
    let app_server_state = app_server_state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        prewarm_agent_runtime_blocking(command_state, app_server_state, provider, cli_path)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub(crate) fn start_agent_chat_stream(
    window: tauri::Window,
    attachment_state: tauri::State<AssistantAttachmentState>,
    approval_state: tauri::State<AgentApprovalState>,
    run_state: tauri::State<AgentRunState>,
    app_server_state: tauri::State<CodexAppServerState>,
    command_state: tauri::State<AgentCommandState>,
    request_id: String,
    path: String,
    provider: String,
    prompt: String,
    context: String,
    attachment_paths: Vec<String>,
    runtime: Option<AgentRuntimeSettings>,
    thread_id: Option<String>,
    cli_path: Option<String>,
) -> Result<(), String> {
    let provider = normalize_agent_provider(&provider);
    let agent_path = command_state.resolve(&provider, cli_path).ok_or_else(|| {
        format!(
            "Cannot find {} on PATH. Install the CLI or set its path in Loby.",
            agent_binary_name(&provider)
        )
    })?;
    let library_path = PathBuf::from(path);
    let attachments = resolve_ai_attachments(attachment_state.inner(), &attachment_paths)?;
    if provider != "codex" && !attachments.is_empty() {
        return Err("当前 AI CLI 运行方式还不能接收附件。".to_string());
    }
    let full_prompt = build_agent_prompt(&provider, &prompt, &context);
    let approval_state = approval_state.inner().clone();
    let run_state = run_state.inner().clone();
    let app_server_state = app_server_state.inner().clone();
    let command_state = command_state.inner().clone();
    let (cancel_sender, cancel_receiver) = mpsc::channel();
    let (steer_sender, steer_receiver) = mpsc::channel();
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

    tauri::async_runtime::spawn_blocking(move || {
        let cleanup_state = run_state.clone();
        let cleanup_request_id = request_id.clone();
        run_agent_chat_stream_blocking(AgentStreamRun {
            window,
            request_id,
            provider,
            agent_path,
            library_path,
            full_prompt,
            attachments,
            runtime: runtime.unwrap_or_default(),
            approval_state,
            app_server_state,
            command_state,
            thread_id,
            cancel_receiver,
            steer_receiver,
        });
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
    let sender = run_state
        .pending
        .lock()
        .map_err(|error| error.to_string())?
        .remove(&request_id);
    if let Some(control) = sender {
        let _ = control.cancel_sender.send(());
    }
    let approval_prefix = format!("{request_id}:");
    let approval_senders = {
        let mut pending = approval_state
            .pending
            .lock()
            .map_err(|error| error.to_string())?;
        let approval_ids = pending
            .keys()
            .filter(|id| id.starts_with(&approval_prefix))
            .cloned()
            .collect::<Vec<_>>();
        approval_ids
            .into_iter()
            .filter_map(|id| pending.remove(&id))
            .collect::<Vec<_>>()
    };
    for sender in approval_senders {
        let _ = sender.send("cancel".to_string());
    }
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
        sender.send(decision).map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn run_agent_chat_blocking(
    path: String,
    provider: String,
    prompt: String,
    context: String,
    attachments: Vec<ResolvedAssistantAttachment>,
    runtime: Option<AgentRuntimeSettings>,
    agent_path: String,
) -> Result<CodexChatResult, String> {
    let library_path = PathBuf::from(path);
    let mut full_prompt = build_agent_prompt(&provider, &prompt, &context);
    let runtime = runtime.unwrap_or_default();

    let (output, command_label) = if provider == "claude" {
        if !attachments.is_empty() {
            return Err("当前 Claude CLI 运行方式还不能接收附件。".to_string());
        }
        let mut command = Command::new(&agent_path);
        command
            .arg("--print")
            .arg(full_prompt)
            .current_dir(&library_path);
        let output = run_command_with_timeout(command, Duration::from_secs(90))?;
        (
            output,
            format!(
                "{} --print <prompt> # cwd {}",
                agent_path,
                library_path.display()
            ),
        )
    } else {
        append_document_attachment_context(&mut full_prompt, &attachments);
        let image_paths = attachment_image_paths(&attachments);
        let mut command = Command::new(&agent_path);
        apply_codex_exec_args(
            &mut command,
            &library_path,
            &full_prompt,
            &image_paths,
            false,
            &runtime,
        );
        let output = run_command_with_timeout(command, Duration::from_secs(90))?;
        (
            output,
            format_codex_exec_command_label(
                &agent_path,
                &library_path,
                image_paths.len(),
                false,
                &runtime,
            ),
        )
    };

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

    Ok(CodexChatResult {
        output: stdout,
        error: stderr,
        command: command_label,
    })
}

fn attachment_image_paths(attachments: &[ResolvedAssistantAttachment]) -> Vec<PathBuf> {
    attachments
        .iter()
        .filter(|attachment| attachment.kind == AssistantAttachmentKind::Image)
        .map(|attachment| attachment.path.clone())
        .collect()
}

fn append_document_attachment_context(
    full_prompt: &mut String,
    attachments: &[ResolvedAssistantAttachment],
) {
    let documents = attachments
        .iter()
        .filter(|attachment| attachment.kind == AssistantAttachmentKind::Document)
        .collect::<Vec<_>>();
    if documents.is_empty() {
        return;
    }
    full_prompt.push_str("\n\n用户附加了以下本地文档，请按需读取：");
    for attachment in documents {
        full_prompt.push_str(&format!(
            "\n- {}：{}",
            attachment.name,
            attachment.path.display()
        ));
    }
}

fn prewarm_agent_runtime_blocking(
    command_state: AgentCommandState,
    app_server_state: CodexAppServerState,
    provider: String,
    cli_path: Option<String>,
) -> Result<(), String> {
    let provider = normalize_agent_provider(&provider);
    let agent_path = command_state.resolve(&provider, cli_path).ok_or_else(|| {
        format!(
            "Cannot find {} on PATH. Install the CLI or set its path in Loby.",
            agent_binary_name(&provider)
        )
    })?;
    if provider != "codex" {
        return Ok(());
    }

    match app_server_state.acquire(&agent_path) {
        Ok((connection, _)) => {
            app_server_state.release(connection);
            Ok(())
        }
        Err(error) => {
            command_state.invalidate_path(&agent_path);
            Err(error)
        }
    }
}

fn build_agent_prompt(provider: &str, prompt: &str, context: &str) -> String {
    let provider_name = if provider == "claude" {
        "Claude Code CLI"
    } else {
        "Codex CLI"
    };
    format!(
        "你是落笔（Loby）写作软件里的 AI 写作助手。你通过 {} 被调用。\
\n\n工作方式：\
\n- 辅助人类写作，不要替用户一键整篇代写。\
\n- 优先给出可审阅的建议、结构调整、局部润色和发布准备。\
\n- 如果用户要求修改正文，先输出建议稿或 diff 风格说明。\
\n- 可以给出直接建议，但仍需避免未经确认覆盖用户正文。\n- 当前写作上下文如下：\n\n{}\n\n用户消息：\n{}",
        provider_name, context, prompt
    )
}

pub(crate) fn apply_codex_exec_args(
    command: &mut Command,
    library_path: &Path,
    full_prompt: &str,
    image_paths: &[PathBuf],
    json: bool,
    runtime: &AgentRuntimeSettings,
) {
    command.arg("exec");
    if json {
        command.arg("--json");
    }
    if !runtime.model.trim().is_empty() && runtime.model.trim() != "auto" {
        command.arg("--model").arg(runtime.model.trim());
    }
    if !runtime.reasoning_effort.trim().is_empty() {
        command.arg("-c").arg(format!(
            "model_reasoning_effort={}",
            toml_string(runtime.reasoning_effort.trim())
        ));
    }
    for image_path in image_paths {
        command.arg("--image").arg(image_path);
    }
    command
        .arg("-c")
        .arg(format!(
            "service_tier={}",
            toml_string(if runtime.quick_mode {
                "priority"
            } else {
                "default"
            })
        ))
        .arg("--skip-git-repo-check")
        .arg("--cd")
        .arg(library_path)
        .arg("--color")
        .arg("never")
        .arg(full_prompt)
        .env("CODEX_NON_INTERACTIVE", "1");
}

pub(crate) fn format_codex_exec_command_label(
    agent_path: &str,
    library_path: &Path,
    image_count: usize,
    json: bool,
    runtime: &AgentRuntimeSettings,
) -> String {
    let mut parts = vec![agent_path.to_string(), "exec".to_string()];
    if json {
        parts.push("--json".to_string());
    }
    if !runtime.model.trim().is_empty() && runtime.model.trim() != "auto" {
        parts.push(format!("--model {}", runtime.model.trim()));
    }
    if !runtime.reasoning_effort.trim().is_empty() {
        parts.push(format!(
            "-c model_reasoning_effort={}",
            toml_string(runtime.reasoning_effort.trim())
        ));
    }
    if image_count > 0 {
        parts.push(format!("--image <{image_count} attachment(s)>"));
    }
    parts.push(format!(
        "-c service_tier={}",
        toml_string(if runtime.quick_mode {
            "priority"
        } else {
            "default"
        })
    ));
    parts.push("--skip-git-repo-check".to_string());
    parts.push(format!("--cd {}", library_path.display()));
    parts.push("--color never <prompt>".to_string());
    parts.join(" ")
}

pub(crate) fn toml_string(value: &str) -> String {
    format!("\"{}\"", value.replace('\\', "\\\\").replace('"', "\\\""))
}

fn run_agent_chat_stream_blocking(run: AgentStreamRun) {
    if run.provider == "codex" {
        run_codex_app_server_stream_blocking(run);
        return;
    }

    let AgentStreamRun {
        window,
        request_id,
        provider: _,
        agent_path,
        library_path,
        full_prompt,
        attachments,
        runtime: _,
        approval_state: _,
        app_server_state: _,
        command_state,
        thread_id: _,
        cancel_receiver,
        steer_receiver: _,
    } = run;

    emit_agent_stream_event(&window, &request_id, "started", "", "");

    if !attachments.is_empty() {
        emit_agent_stream_event(
            &window,
            &request_id,
            "error",
            "",
            "当前 AI CLI 运行方式还不能接收附件。",
        );
        return;
    }

    let mut command = Command::new(&agent_path);
    command
        .arg("--print")
        .arg(full_prompt)
        .current_dir(&library_path)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = match command.spawn() {
        Ok(child) => child,
        Err(error) => {
            command_state.invalidate_path(&agent_path);
            emit_agent_stream_event(&window, &request_id, "error", "", &error.to_string());
            return;
        }
    };

    let stderr_reader = child.stderr.take().map(|stderr| {
        thread::spawn(move || {
            let mut buffer = String::new();
            let mut reader = BufReader::new(stderr);
            let _ = reader.read_to_string(&mut buffer);
            buffer
        })
    });

    let Some(stdout) = child.stdout.take() else {
        emit_agent_stream_event(
            &window,
            &request_id,
            "error",
            "",
            "AI CLI stdout is unavailable.",
        );
        let _ = child.kill();
        return;
    };

    let (line_sender, line_receiver) = mpsc::channel();
    thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line_result in reader.lines() {
            let Ok(line) = line_result else {
                continue;
            };
            if line_sender.send(line).is_err() {
                break;
            }
        }
    });

    loop {
        if cancel_receiver.try_recv().is_ok() {
            let _ = child.kill();
            emit_agent_stream_event(&window, &request_id, "cancelled", "已取消本次请求。", "");
            return;
        }
        match line_receiver.recv_timeout(Duration::from_millis(100)) {
            Ok(line) if !line.trim().is_empty() => {
                emit_agent_stream_event(&window, &request_id, "delta", &format!("{}\n", line), "");
            }
            Ok(_) => {}
            Err(mpsc::RecvTimeoutError::Timeout) => {
                if child.try_wait().ok().flatten().is_some() {
                    break;
                }
            }
            Err(mpsc::RecvTimeoutError::Disconnected) => break,
        }
    }

    let status = child.wait();
    let stderr = stderr_reader
        .and_then(|handle| handle.join().ok())
        .unwrap_or_default()
        .trim()
        .to_string();

    match status {
        Ok(exit_status) if exit_status.success() => {
            emit_agent_stream_event(&window, &request_id, "done", "", "");
        }
        Ok(_) => {
            let error = if stderr.is_empty() {
                "AI CLI exited with a non-zero status.".to_string()
            } else {
                stderr
            };
            emit_agent_stream_event(&window, &request_id, "error", "", &error);
        }
        Err(error) => {
            emit_agent_stream_event(&window, &request_id, "error", "", &error.to_string());
        }
    }
}
