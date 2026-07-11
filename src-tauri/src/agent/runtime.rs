use super::app_server::run_codex_app_server_stream_blocking;
use super::events::emit_agent_stream_event;
use super::process::{
    agent_binary_name, normalize_agent_provider, resolve_agent_command, run_command_with_timeout,
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
    pending: Arc<Mutex<HashMap<String, mpsc::Sender<()>>>>,
}

pub(super) struct AgentStreamRun {
    pub(super) window: tauri::Window,
    pub(super) request_id: String,
    pub(super) provider: String,
    pub(super) agent_path: String,
    pub(super) library_path: PathBuf,
    pub(super) full_prompt: String,
    pub(super) runtime: AgentRuntimeSettings,
    pub(super) approval_state: AgentApprovalState,
    pub(super) thread_id: Option<String>,
    pub(super) cancel_receiver: mpsc::Receiver<()>,
}

#[tauri::command]
pub(crate) async fn run_agent_chat(
    path: String,
    provider: String,
    prompt: String,
    context: String,
    plan_mode: bool,
    runtime: Option<AgentRuntimeSettings>,
    cli_path: Option<String>,
) -> Result<CodexChatResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        run_agent_chat_blocking(
            path, provider, prompt, context, plan_mode, runtime, cli_path,
        )
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub(crate) fn start_agent_chat_stream(
    window: tauri::Window,
    approval_state: tauri::State<AgentApprovalState>,
    run_state: tauri::State<AgentRunState>,
    request_id: String,
    path: String,
    provider: String,
    prompt: String,
    context: String,
    plan_mode: bool,
    runtime: Option<AgentRuntimeSettings>,
    thread_id: Option<String>,
    cli_path: Option<String>,
) -> Result<(), String> {
    let provider = normalize_agent_provider(&provider);
    let agent_path = resolve_agent_command(&provider, cli_path).ok_or_else(|| {
        format!(
            "Cannot find {} on PATH. Install the CLI or set its path in Nibva.",
            agent_binary_name(&provider)
        )
    })?;
    let library_path = PathBuf::from(path);
    let full_prompt = build_agent_prompt(&provider, &prompt, &context, plan_mode);
    let approval_state = approval_state.inner().clone();
    let run_state = run_state.inner().clone();
    let (cancel_sender, cancel_receiver) = mpsc::channel();
    run_state
        .pending
        .lock()
        .map_err(|error| error.to_string())?
        .insert(request_id.clone(), cancel_sender);

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
            runtime: runtime.unwrap_or_default(),
            approval_state,
            thread_id,
            cancel_receiver,
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
    if let Some(sender) = sender {
        let _ = sender.send(());
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
    plan_mode: bool,
    runtime: Option<AgentRuntimeSettings>,
    cli_path: Option<String>,
) -> Result<CodexChatResult, String> {
    let provider = normalize_agent_provider(&provider);
    let agent_path = resolve_agent_command(&provider, cli_path).ok_or_else(|| {
        format!(
            "Cannot find {} on PATH. Install the CLI or set its path in Nibva.",
            agent_binary_name(&provider)
        )
    })?;
    let library_path = PathBuf::from(path);
    let full_prompt = build_agent_prompt(&provider, &prompt, &context, plan_mode);
    let runtime = runtime.unwrap_or_default();

    let (output, command_label) = if provider == "claude" {
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
        let mut command = Command::new(&agent_path);
        apply_codex_exec_args(&mut command, &library_path, &full_prompt, false, &runtime);
        let output = run_command_with_timeout(command, Duration::from_secs(90))?;
        (
            output,
            format_codex_exec_command_label(&agent_path, &library_path, false, &runtime),
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

fn build_agent_prompt(provider: &str, prompt: &str, context: &str, plan_mode: bool) -> String {
    let mode_text = if plan_mode {
        "当前处于 Plan Mode。先分析和制定计划，不要直接改写正文；输出可执行步骤、风险和建议修改范围。"
    } else {
        "当前处于 Default Mode。可以给出直接建议，但仍需避免未经确认覆盖用户正文。"
    };
    let provider_name = if provider == "claude" {
        "Claude Code CLI"
    } else {
        "Codex CLI"
    };
    format!(
        "你是 Nibva 写作软件里的 AI 写作助手。你通过 {} 被调用。\
\n\n工作方式：\
\n- 辅助人类写作，不要替用户一键整篇代写。\
\n- 优先给出可审阅的建议、结构调整、局部润色和发布准备。\
\n- 如果用户要求修改正文，先输出建议稿或 diff 风格说明。\
\n- {}\n- 当前写作上下文如下：\n\n{}\n\n用户消息：\n{}",
        provider_name, mode_text, context, prompt
    )
}

fn apply_codex_exec_args(
    command: &mut Command,
    library_path: &Path,
    full_prompt: &str,
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
        runtime: _,
        approval_state: _,
        thread_id: _,
        cancel_receiver,
    } = run;

    emit_agent_stream_event(&window, &request_id, "started", "", "");

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
