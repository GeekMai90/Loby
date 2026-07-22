//! [INPUT]: 依赖 agent events/protocol/runtime、Codex app-server 子进程 stdio、线程/channel 与 JSON-RPC 队列
//! [OUTPUT]: 向 agent runtime 提供 run_codex_app_server_stream_blocking 阻塞流循环
//! [POS]: 本地 AI agent 领域，封装 Codex 进程、协议、流式事件与会话附件持久化
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use super::events::{
    app_server_turn_id, emit_agent_event, emit_agent_stream_event,
    emit_app_server_approval_request, emit_app_server_notification, empty_agent_event,
};
use super::protocol::{
    build_app_server_approval_response, build_app_server_thread_resume,
    build_app_server_thread_start, build_app_server_turn_start, build_app_server_turn_steer,
    format_json_rpc_error, is_app_server_approval_request, is_json_rpc_error,
    normalize_approval_decision,
};
use super::runtime::{AgentApprovalState, AgentStreamRun};
use std::collections::{HashSet, VecDeque};
use std::io::{BufRead, BufReader, Read, Write};
use std::process::{Command, Stdio};
use std::sync::mpsc;
use std::thread;
use std::time::Duration;

pub(super) fn run_codex_app_server_stream_blocking(run: AgentStreamRun) {
    let AgentStreamRun {
        window,
        request_id,
        provider: _,
        agent_path,
        library_path,
        full_prompt,
        image_paths,
        runtime,
        approval_state,
        thread_id: existing_thread_id,
        cancel_receiver,
        steer_receiver,
    } = run;

    emit_agent_stream_event(&window, &request_id, "started", "", "");

    let mut command = Command::new(&agent_path);
    command
        .arg("app-server")
        .arg("--stdio")
        .stdin(Stdio::piped())
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
            "Codex app-server stdout is unavailable.",
        );
        let _ = child.kill();
        return;
    };
    let Some(mut stdin) = child.stdin.take() else {
        emit_agent_stream_event(
            &window,
            &request_id,
            "error",
            "",
            "Codex app-server stdin is unavailable.",
        );
        let _ = child.kill();
        return;
    };

    if let Err(error) = write_app_server_message(
        &mut stdin,
        serde_json::json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "clientInfo": {
                    "name": "loby",
                    "title": "落笔",
                    "version": env!("CARGO_PKG_VERSION"),
                },
                "capabilities": {
                    "experimentalApi": true,
                    "requestAttestation": false,
                },
            },
        }),
    ) {
        emit_agent_stream_event(&window, &request_id, "error", "", &error);
        let _ = child.kill();
        return;
    }

    let (line_sender, line_receiver) = mpsc::channel();
    thread::spawn(move || {
        let mut reader = BufReader::new(stdout);
        let mut line = String::new();
        loop {
            line.clear();
            let read = match reader.read_line(&mut line) {
                Ok(read) => read,
                Err(_) => break,
            };
            if read == 0 {
                break;
            }
            if line_sender.send(line.trim().to_string()).is_err() {
                break;
            }
        }
    });

    let mut initialized = false;
    let mut thread_requested = false;
    let mut turn_requested = false;
    let mut completed = false;
    let mut thread_id = String::new();
    let mut turn_id = String::new();
    let mut cancelled = false;
    let mut queued_steers = VecDeque::new();
    let mut pending_steer_request_ids = HashSet::new();
    let mut next_steer_request_id = 4_u64;

    loop {
        if cancel_receiver.try_recv().is_ok() {
            cancelled = true;
            break;
        }

        while let Ok(text) = steer_receiver.try_recv() {
            queued_steers.push_back(text);
        }
        while !thread_id.is_empty() && !turn_id.is_empty() {
            let Some(text) = queued_steers.pop_front() else {
                break;
            };
            let steer_request_id = next_steer_request_id;
            next_steer_request_id += 1;
            if let Err(error) = write_app_server_message(
                &mut stdin,
                build_app_server_turn_steer(steer_request_id, &thread_id, &turn_id, &text),
            ) {
                emit_agent_stream_event(&window, &request_id, "error", "", &error);
                break;
            }
            pending_steer_request_ids.insert(steer_request_id);
        }

        let trimmed = match line_receiver.recv_timeout(Duration::from_millis(100)) {
            Ok(line) => line,
            Err(mpsc::RecvTimeoutError::Timeout) => {
                if child.try_wait().ok().flatten().is_some() {
                    break;
                }
                continue;
            }
            Err(mpsc::RecvTimeoutError::Disconnected) => break,
        };
        if trimmed.is_empty() {
            continue;
        }

        let Ok(value) = serde_json::from_str::<serde_json::Value>(&trimmed) else {
            continue;
        };
        if value.get("timestamp").is_some() && value.get("level").is_some() {
            continue;
        }

        if is_json_rpc_error(&value) {
            let response_id = value.get("id").and_then(|id| id.as_u64());
            if response_id.is_some_and(|id| pending_steer_request_ids.remove(&id)) {
                let mut event = empty_agent_event(&request_id, "activity");
                event.raw_type = "turn/steer.error".to_string();
                event.item_id = format!("turn-steer-error-{}", response_id.unwrap_or_default());
                event.item_type = "steer".to_string();
                event.status = "error".to_string();
                event.title = "引导未送达".to_string();
                event.text = format_json_rpc_error(&value);
                emit_agent_event(&window, event);
                continue;
            }
            emit_agent_stream_event(
                &window,
                &request_id,
                "error",
                "",
                &format_json_rpc_error(&value),
            );
            break;
        }

        if value.get("method").is_none()
            && value
                .get("id")
                .and_then(|id| id.as_u64())
                .is_some_and(|id| pending_steer_request_ids.remove(&id))
        {
            let mut event = empty_agent_event(&request_id, "status");
            event.raw_type = "turn/steer.result".to_string();
            event.title = "已接收补充引导".to_string();
            event.status = turn_id.clone();
            emit_agent_event(&window, event);
            continue;
        }

        if !initialized && value.get("id").and_then(|id| id.as_i64()) == Some(1) {
            initialized = true;
            if let Err(error) = write_app_server_message(
                &mut stdin,
                serde_json::json!({
                    "jsonrpc": "2.0",
                    "method": "initialized",
                }),
            ) {
                emit_agent_stream_event(&window, &request_id, "error", "", &error);
                break;
            }
        }

        let resume_existing_thread = existing_thread_id
            .as_deref()
            .map(|id| !id.trim().is_empty())
            .unwrap_or(false);

        if initialized && !thread_requested {
            thread_requested = true;
            let thread_request = existing_thread_id
                .as_deref()
                .filter(|id| !id.trim().is_empty())
                .map(|id| build_app_server_thread_resume(id, &library_path, &runtime))
                .unwrap_or_else(|| build_app_server_thread_start(&library_path, &runtime));
            if let Err(error) = write_app_server_message(&mut stdin, thread_request) {
                emit_agent_stream_event(&window, &request_id, "error", "", &error);
                break;
            }
        }

        if value.get("id").and_then(|id| id.as_i64()) == Some(2) {
            if let Some(id) = value
                .get("result")
                .and_then(|result| result.get("thread"))
                .and_then(|thread| thread.get("id"))
                .and_then(|id| id.as_str())
            {
                thread_id = id.to_string();
                let mut event = empty_agent_event(&request_id, "status");
                event.raw_type = if resume_existing_thread {
                    "thread/resume.result"
                } else {
                    "thread/start.result"
                }
                .to_string();
                event.title = if resume_existing_thread {
                    "Codex 会话已恢复"
                } else {
                    "Codex 会话已启动"
                }
                .to_string();
                event.status = thread_id.clone();
                emit_agent_event(&window, event);
            }
        }

        if !turn_requested && !thread_id.is_empty() {
            turn_requested = true;
            if let Err(error) = write_app_server_message(
                &mut stdin,
                build_app_server_turn_start(
                    &thread_id,
                    &library_path,
                    &full_prompt,
                    &image_paths,
                    &runtime,
                ),
            ) {
                emit_agent_stream_event(&window, &request_id, "error", "", &error);
                break;
            }
        }

        if let Some(method) = value.get("method").and_then(|method| method.as_str()) {
            if method == "turn/started" {
                turn_id = app_server_turn_id(&value);
            }
            if is_app_server_approval_request(method) {
                let decision = wait_for_app_server_approval(
                    &window,
                    &request_id,
                    method,
                    &value,
                    &approval_state,
                );
                let _ = write_app_server_message(
                    &mut stdin,
                    build_app_server_approval_response(&value, &decision),
                );
                continue;
            }

            if emit_app_server_notification(&window, &request_id, method, &value) {
                completed = true;
                break;
            }
        }
    }

    let _ = child.kill();
    let _ = child.wait();

    if cancelled {
        emit_agent_stream_event(&window, &request_id, "cancelled", "已取消本次请求。", "");
    } else if completed {
        emit_agent_stream_event(&window, &request_id, "done", "", "");
    } else {
        let stderr = stderr_reader
            .and_then(|handle| handle.join().ok())
            .unwrap_or_default()
            .trim()
            .to_string();
        if !stderr.is_empty() {
            emit_agent_stream_event(&window, &request_id, "error", "", &stderr);
        }
    }
}

fn write_app_server_message(
    stdin: &mut std::process::ChildStdin,
    value: serde_json::Value,
) -> Result<(), String> {
    let raw = serde_json::to_string(&value).map_err(|error| error.to_string())?;
    stdin
        .write_all(raw.as_bytes())
        .and_then(|_| stdin.write_all(b"\n"))
        .and_then(|_| stdin.flush())
        .map_err(|error| error.to_string())
}

fn wait_for_app_server_approval(
    window: &tauri::Window,
    request_id: &str,
    method: &str,
    value: &serde_json::Value,
    approval_state: &AgentApprovalState,
) -> String {
    let approval_id = format!(
        "{}:{}",
        request_id,
        value
            .get("id")
            .map(|id| id.to_string())
            .unwrap_or_else(|| "approval".to_string())
    );
    let (sender, receiver) = mpsc::channel();
    if let Ok(mut pending) = approval_state.pending.lock() {
        pending.insert(approval_id.clone(), sender);
    }
    emit_app_server_approval_request(window, request_id, method, value, &approval_id);
    let decision = receiver
        .recv_timeout(Duration::from_secs(600))
        .unwrap_or_else(|_| "decline".to_string());
    if let Ok(mut pending) = approval_state.pending.lock() {
        pending.remove(&approval_id);
    }
    normalize_approval_decision(&decision)
}
