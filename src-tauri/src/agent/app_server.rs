//! [INPUT]: 依赖 agent events/protocol/runtime、Codex app-server 子进程 stdio、应用级连接池与 JSON-RPC 队列
//! [OUTPUT]: 向 agent runtime 提供 CodexAppServerState、长生命周期流循环与分阶段耗时事件
//! [POS]: 本地 AI agent 领域的 Codex 传输边界，复用已初始化进程并隔离每轮请求、审批、取消、指标与故障恢复
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use super::events::{
    app_server_turn_id, emit_agent_event, emit_agent_metric, emit_agent_stream_event,
    emit_app_server_approval_request, emit_app_server_notification, empty_agent_event,
};
use super::protocol::{
    build_app_server_approval_response, build_app_server_thread_read,
    build_app_server_thread_resume, build_app_server_thread_start, build_app_server_turn_interrupt,
    build_app_server_turn_start, build_app_server_turn_steer, format_json_rpc_error,
    is_app_server_approval_request, is_json_rpc_error, normalize_approval_decision,
};
use super::runtime::{AgentApprovalState, AgentStreamRun};
use super::turn_recovery::{recover_turn_from_thread_read, recovery_delta, TurnRecovery};
use std::collections::{HashSet, VecDeque};
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::{mpsc, Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

const APP_SERVER_INITIALIZE_TIMEOUT: Duration = Duration::from_secs(30);
const APP_SERVER_THREAD_TIMEOUT: Duration = Duration::from_secs(45);
const APP_SERVER_TURN_START_TIMEOUT: Duration = Duration::from_secs(45);
const APP_SERVER_TURN_IDLE_TIMEOUT: Duration = Duration::from_secs(600);
const APP_SERVER_RECOVERY_DELAY: Duration = Duration::from_secs(5);
const APP_SERVER_RECOVERY_INTERVAL: Duration = Duration::from_secs(3);
const APP_SERVER_INTERRUPT_TIMEOUT: Duration = Duration::from_secs(10);
const APP_SERVER_POLL_INTERVAL: Duration = Duration::from_millis(100);
const MAX_IDLE_CONNECTIONS_PER_BINARY: usize = 2;
const MAX_STDERR_LINES: usize = 20;

#[derive(Clone, Default)]
pub(crate) struct CodexAppServerState {
    idle: Arc<Mutex<Vec<CodexAppServerConnection>>>,
}

impl CodexAppServerState {
    fn acquire(&self, agent_path: &str) -> Result<(CodexAppServerConnection, bool), String> {
        loop {
            let candidate = {
                let mut idle = self.idle.lock().map_err(|error| error.to_string())?;
                idle.iter()
                    .rposition(|connection| connection.agent_path == agent_path)
                    .map(|index| idle.swap_remove(index))
            };

            match candidate {
                Some(mut connection) => {
                    if connection.is_alive() {
                        return Ok((connection, true));
                    }
                }
                None => {
                    return CodexAppServerConnection::spawn(agent_path)
                        .map(|connection| (connection, false));
                }
            }
        }
    }

    fn release(&self, mut connection: CodexAppServerConnection) {
        if !connection.is_alive() {
            return;
        }
        let Ok(mut idle) = self.idle.lock() else {
            return;
        };
        let matching_count = idle
            .iter()
            .filter(|candidate| candidate.agent_path == connection.agent_path)
            .count();
        if matching_count < MAX_IDLE_CONNECTIONS_PER_BINARY {
            idle.push(connection);
        }
    }
}

struct CodexAppServerConnection {
    agent_path: String,
    child: Child,
    stdin: ChildStdin,
    line_receiver: mpsc::Receiver<String>,
    stderr_receiver: mpsc::Receiver<String>,
    stderr_tail: VecDeque<String>,
    next_request_id: u64,
}

impl CodexAppServerConnection {
    fn spawn(agent_path: &str) -> Result<Self, String> {
        let mut command = Command::new(agent_path);
        command
            .arg("app-server")
            .arg("--stdio")
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let mut child = command.spawn().map_err(|error| error.to_string())?;
        let stdout = child.stdout.take().ok_or_else(|| {
            let _ = child.kill();
            "Codex app-server stdout is unavailable.".to_string()
        })?;
        let stdin = child.stdin.take().ok_or_else(|| {
            let _ = child.kill();
            "Codex app-server stdin is unavailable.".to_string()
        })?;
        let stderr = child.stderr.take().ok_or_else(|| {
            let _ = child.kill();
            "Codex app-server stderr is unavailable.".to_string()
        })?;

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

        let (stderr_sender, stderr_receiver) = mpsc::sync_channel(128);
        thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines().map_while(Result::ok) {
                let _ = stderr_sender.try_send(line);
            }
        });

        let mut connection = Self {
            agent_path: agent_path.to_string(),
            child,
            stdin,
            line_receiver,
            stderr_receiver,
            stderr_tail: VecDeque::new(),
            next_request_id: 1,
        };
        connection.initialize()?;
        Ok(connection)
    }

    fn initialize(&mut self) -> Result<(), String> {
        let initialize_request_id = self.allocate_request_id();
        self.send(serde_json::json!({
            "jsonrpc": "2.0",
            "id": initialize_request_id,
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
        }))?;

        let deadline = Instant::now() + APP_SERVER_INITIALIZE_TIMEOUT;
        loop {
            if Instant::now() >= deadline {
                return Err(self.diagnostic("Codex app-server initialization timed out."));
            }
            match self.line_receiver.recv_timeout(APP_SERVER_POLL_INTERVAL) {
                Ok(line) => {
                    let Some(value) = parse_app_server_line(&line) else {
                        continue;
                    };
                    if value.get("id").and_then(|id| id.as_u64()) != Some(initialize_request_id) {
                        continue;
                    }
                    if is_json_rpc_error(&value) {
                        return Err(format_json_rpc_error(&value));
                    }
                    self.send(serde_json::json!({
                        "jsonrpc": "2.0",
                        "method": "initialized",
                        "params": {},
                    }))?;
                    return Ok(());
                }
                Err(mpsc::RecvTimeoutError::Timeout) => {
                    if !self.is_alive() {
                        return Err(
                            self.diagnostic("Codex app-server exited during initialization.")
                        );
                    }
                }
                Err(mpsc::RecvTimeoutError::Disconnected) => {
                    return Err(
                        self.diagnostic("Codex app-server disconnected during initialization.")
                    );
                }
            }
        }
    }

    fn allocate_request_id(&mut self) -> u64 {
        let request_id = self.next_request_id;
        self.next_request_id = self.next_request_id.saturating_add(1);
        request_id
    }

    fn send(&mut self, value: serde_json::Value) -> Result<(), String> {
        let raw = serde_json::to_string(&value).map_err(|error| error.to_string())?;
        self.stdin
            .write_all(raw.as_bytes())
            .and_then(|_| self.stdin.write_all(b"\n"))
            .and_then(|_| self.stdin.flush())
            .map_err(|error| error.to_string())
    }

    fn is_alive(&mut self) -> bool {
        self.drain_stderr();
        matches!(self.child.try_wait(), Ok(None))
    }

    fn diagnostic(&mut self, fallback: &str) -> String {
        self.drain_stderr();
        if self.stderr_tail.is_empty() {
            fallback.to_string()
        } else {
            self.stderr_tail
                .iter()
                .cloned()
                .collect::<Vec<_>>()
                .join("\n")
        }
    }

    fn drain_stderr(&mut self) {
        while let Ok(line) = self.stderr_receiver.try_recv() {
            if line.trim().is_empty() {
                continue;
            }
            self.stderr_tail.push_back(line);
            while self.stderr_tail.len() > MAX_STDERR_LINES {
                self.stderr_tail.pop_front();
            }
        }
    }
}

impl Drop for CodexAppServerConnection {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

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
        app_server_state,
        thread_id: existing_thread_id,
        cancel_receiver,
        steer_receiver,
    } = run;

    let run_started_at = Instant::now();
    emit_agent_stream_event(&window, &request_id, "started", "", "");

    let runtime_started_at = Instant::now();
    let (mut connection, reused) = match app_server_state.acquire(&agent_path) {
        Ok(connection) => connection,
        Err(error) => {
            emit_agent_stream_event(&window, &request_id, "error", "", &error);
            return;
        }
    };
    eprintln!(
        "[loby][agent][{request_id}] app_server_ready mode={} elapsed_ms={}",
        if reused { "warm" } else { "cold" },
        runtime_started_at.elapsed().as_millis()
    );
    emit_agent_metric(
        &window,
        &request_id,
        "runtime/ready",
        if reused { "warm" } else { "cold" },
        elapsed_millis(run_started_at),
    );

    let resume_existing_thread = existing_thread_id
        .as_deref()
        .is_some_and(|id| !id.trim().is_empty());
    let thread_request_id = connection.allocate_request_id();
    let thread_request = existing_thread_id
        .as_deref()
        .filter(|id| !id.trim().is_empty())
        .map(|id| build_app_server_thread_resume(thread_request_id, id, &library_path, &runtime))
        .unwrap_or_else(|| {
            build_app_server_thread_start(thread_request_id, &library_path, &runtime)
        });
    if let Err(error) = connection.send(thread_request) {
        emit_agent_stream_event(&window, &request_id, "error", "", &error);
        return;
    }

    let thread_deadline = Instant::now() + APP_SERVER_THREAD_TIMEOUT;
    let mut turn_deadline = None;
    let mut interrupt_deadline = None;
    let mut turn_request_id = None;
    let mut interrupt_request_id = None;
    let mut recovery_request_id = None;
    let mut thread_id = String::new();
    let mut turn_id = String::new();
    let mut last_active_message_at = Instant::now();
    let mut first_delta_recorded = false;
    let mut streamed_agent_text = String::new();
    let mut streamed_agent_item_id = String::new();
    let mut turn_ready_recorded = false;
    let mut completed = false;
    let mut cancelled = false;
    let mut failure = None;
    let mut queued_steers = VecDeque::new();
    let mut pending_steer_request_ids = HashSet::new();
    let mut next_recovery_at = None;

    loop {
        if !cancelled && cancel_receiver.try_recv().is_ok() {
            cancelled = true;
            if thread_id.is_empty() || turn_id.is_empty() {
                failure = Some("本轮在 Codex 建立完成前被取消。".to_string());
                break;
            }
            let request = connection.allocate_request_id();
            interrupt_request_id = Some(request);
            interrupt_deadline = Some(Instant::now() + APP_SERVER_INTERRUPT_TIMEOUT);
            if let Err(error) = connection.send(build_app_server_turn_interrupt(
                request, &thread_id, &turn_id,
            )) {
                failure = Some(error);
                break;
            }
        }

        if !cancelled {
            while let Ok(text) = steer_receiver.try_recv() {
                queued_steers.push_back(text);
            }
            while !thread_id.is_empty() && !turn_id.is_empty() {
                let Some(text) = queued_steers.pop_front() else {
                    break;
                };
                let steer_request_id = connection.allocate_request_id();
                if let Err(error) = connection.send(build_app_server_turn_steer(
                    steer_request_id,
                    &thread_id,
                    &turn_id,
                    &text,
                )) {
                    let mut event = empty_agent_event(&request_id, "activity");
                    event.raw_type = "turn/steer.error".to_string();
                    event.item_id = format!("turn-steer-error-{steer_request_id}");
                    event.item_type = "steer".to_string();
                    event.status = "error".to_string();
                    event.title = "引导未送达".to_string();
                    event.text = error;
                    emit_agent_event(&window, event);
                    break;
                }
                pending_steer_request_ids.insert(steer_request_id);
            }
        }

        let now = Instant::now();
        if thread_id.is_empty() && now >= thread_deadline {
            failure = Some("Codex 会话启动或恢复超时。".to_string());
            break;
        }
        if turn_request_id.is_some()
            && turn_id.is_empty()
            && turn_deadline.is_some_and(|deadline| now >= deadline)
        {
            failure = Some("Codex 本轮启动超时。".to_string());
            break;
        }
        if !turn_id.is_empty()
            && !cancelled
            && now.duration_since(last_active_message_at) >= APP_SERVER_TURN_IDLE_TIMEOUT
        {
            failure = Some("Codex 本轮长时间没有返回运行事件。".to_string());
            break;
        }
        if cancelled && interrupt_deadline.is_some_and(|deadline| now >= deadline) {
            failure = Some("Codex 未在取消请求后及时结束本轮。".to_string());
            break;
        }
        if !cancelled
            && !turn_id.is_empty()
            && recovery_request_id.is_none()
            && next_recovery_at.is_some_and(|deadline| now >= deadline)
        {
            let request = connection.allocate_request_id();
            if let Err(error) = connection.send(build_app_server_thread_read(request, &thread_id)) {
                failure = Some(error);
                break;
            }
            recovery_request_id = Some(request);
            next_recovery_at = None;
        }

        let value = match connection
            .line_receiver
            .recv_timeout(APP_SERVER_POLL_INTERVAL)
        {
            Ok(line) => {
                let Some(value) = parse_app_server_line(&line) else {
                    continue;
                };
                value
            }
            Err(mpsc::RecvTimeoutError::Timeout) => {
                if !connection.is_alive() {
                    failure = Some(connection.diagnostic("Codex app-server exited unexpectedly."));
                    break;
                }
                continue;
            }
            Err(mpsc::RecvTimeoutError::Disconnected) => {
                failure =
                    Some(connection.diagnostic("Codex app-server disconnected unexpectedly."));
                break;
            }
        };

        let response_id = value.get("id").and_then(|id| id.as_u64());
        if is_json_rpc_error(&value) {
            if response_id == recovery_request_id {
                recovery_request_id = None;
                next_recovery_at = Some(Instant::now() + APP_SERVER_RECOVERY_INTERVAL);
                continue;
            }
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
            if response_id == Some(thread_request_id)
                || response_id == turn_request_id
                || response_id == interrupt_request_id
            {
                failure = Some(format_json_rpc_error(&value));
                break;
            }
            continue;
        }

        if response_id == Some(thread_request_id) {
            let Some(next_thread_id) = value
                .get("result")
                .and_then(|result| result.get("thread"))
                .and_then(|thread| thread.get("id"))
                .and_then(|id| id.as_str())
                .filter(|id| !id.is_empty())
            else {
                failure = Some("Codex app-server returned no thread id.".to_string());
                break;
            };
            thread_id = next_thread_id.to_string();
            eprintln!(
                "[loby][agent][{request_id}] thread_ready elapsed_ms={}",
                run_started_at.elapsed().as_millis()
            );
            emit_agent_metric(
                &window,
                &request_id,
                "thread/ready",
                if resume_existing_thread {
                    "resumed"
                } else {
                    "started"
                },
                elapsed_millis(run_started_at),
            );

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

            let request = connection.allocate_request_id();
            turn_request_id = Some(request);
            turn_deadline = Some(Instant::now() + APP_SERVER_TURN_START_TIMEOUT);
            if let Err(error) = connection.send(build_app_server_turn_start(
                request,
                &thread_id,
                &library_path,
                &full_prompt,
                &image_paths,
                &runtime,
            )) {
                failure = Some(error);
                break;
            }
            continue;
        }

        if response_id == turn_request_id {
            if let Some(next_turn_id) = value
                .get("result")
                .and_then(|result| result.get("turn"))
                .and_then(|turn| turn.get("id"))
                .and_then(|id| id.as_str())
                .filter(|id| !id.is_empty())
            {
                turn_id = next_turn_id.to_string();
                last_active_message_at = Instant::now();
                next_recovery_at = Some(Instant::now() + APP_SERVER_RECOVERY_DELAY);
                eprintln!(
                    "[loby][agent][{request_id}] turn_ready elapsed_ms={}",
                    run_started_at.elapsed().as_millis()
                );
                turn_ready_recorded = true;
                emit_agent_metric(
                    &window,
                    &request_id,
                    "turn/ready",
                    "",
                    elapsed_millis(run_started_at),
                );
            }
            continue;
        }

        if response_id == recovery_request_id {
            recovery_request_id = None;
            match recover_turn_from_thread_read(&value, &turn_id) {
                TurnRecovery::Completed { item_id, text } => {
                    if let Some(delta) = recovery_delta(&streamed_agent_text, &text) {
                        let mut event = empty_agent_event(&request_id, "delta");
                        event.raw_type = "thread/read.recovered".to_string();
                        event.item_id = if streamed_agent_item_id.is_empty() {
                            item_id
                        } else {
                            streamed_agent_item_id.clone()
                        };
                        event.item_type = "agentMessage".to_string();
                        event.text = delta.to_string();
                        emit_agent_event(&window, event);
                    }
                    let mut event = empty_agent_event(&request_id, "status");
                    event.raw_type = "turn/completed.recovered".to_string();
                    event.title = "已恢复 Codex 完成结果".to_string();
                    event.status = turn_id.clone();
                    emit_agent_event(&window, event);
                    emit_agent_metric(
                        &window,
                        &request_id,
                        "turn/completed",
                        "recovered",
                        elapsed_millis(run_started_at),
                    );
                    completed = true;
                    break;
                }
                TurnRecovery::Failed(error) => {
                    failure = Some(error);
                    break;
                }
                TurnRecovery::Pending => {
                    next_recovery_at = Some(Instant::now() + APP_SERVER_RECOVERY_INTERVAL);
                    continue;
                }
            }
        }

        if response_id.is_some_and(|id| pending_steer_request_ids.remove(&id)) {
            let mut event = empty_agent_event(&request_id, "status");
            event.raw_type = "turn/steer.result".to_string();
            event.title = "已接收补充引导".to_string();
            event.status = turn_id.clone();
            emit_agent_event(&window, event);
            continue;
        }

        if response_id == interrupt_request_id {
            continue;
        }

        let Some(method) = value.get("method").and_then(|method| method.as_str()) else {
            continue;
        };

        if is_app_server_approval_request(method) {
            if !message_matches_active_run(&value, &turn_id) {
                let _ = connection.send(build_app_server_approval_response(&value, "decline"));
                continue;
            }
            let decision =
                wait_for_app_server_approval(&window, &request_id, method, &value, &approval_state);
            if let Err(error) =
                connection.send(build_app_server_approval_response(&value, &decision))
            {
                failure = Some(error);
                break;
            }
            continue;
        }

        if method == "turn/started" && turn_id.is_empty() {
            turn_id = app_server_turn_id(&value);
            next_recovery_at = Some(Instant::now() + APP_SERVER_RECOVERY_DELAY);
            if !turn_id.is_empty() && !turn_ready_recorded {
                turn_ready_recorded = true;
                emit_agent_metric(
                    &window,
                    &request_id,
                    "turn/ready",
                    "",
                    elapsed_millis(run_started_at),
                );
            }
        }
        if !message_matches_active_turn(method, &value, &turn_id) {
            continue;
        }
        last_active_message_at = Instant::now();
        next_recovery_at = Some(last_active_message_at + APP_SERVER_RECOVERY_DELAY);

        if method == "item/agentMessage/delta" {
            if let Some((item_id, delta)) =
                super::events::parse_app_server_agent_message_delta(&value)
            {
                streamed_agent_item_id = item_id;
                streamed_agent_text.push_str(&delta);
            }
        }

        if method == "item/agentMessage/delta" && !first_delta_recorded {
            first_delta_recorded = true;
            eprintln!(
                "[loby][agent][{request_id}] first_text_delta elapsed_ms={}",
                run_started_at.elapsed().as_millis()
            );
            emit_agent_metric(
                &window,
                &request_id,
                "response/first-delta",
                "",
                elapsed_millis(run_started_at),
            );
        }

        if emit_app_server_notification(&window, &request_id, method, &value) {
            emit_agent_metric(
                &window,
                &request_id,
                "turn/completed",
                "",
                elapsed_millis(run_started_at),
            );
            completed = true;
            break;
        }
    }

    if completed {
        eprintln!(
            "[loby][agent][{request_id}] completed elapsed_ms={}",
            run_started_at.elapsed().as_millis()
        );
        app_server_state.release(connection);
    }

    if cancelled {
        emit_agent_stream_event(&window, &request_id, "cancelled", "已取消本次请求。", "");
    } else if completed {
        emit_agent_stream_event(&window, &request_id, "done", "", "");
    } else {
        let error = failure.unwrap_or_else(|| "Codex app-server ended unexpectedly.".to_string());
        emit_agent_stream_event(&window, &request_id, "error", "", &error);
    }
}

fn elapsed_millis(started_at: Instant) -> u64 {
    started_at.elapsed().as_millis().min(u128::from(u64::MAX)) as u64
}

fn parse_app_server_line(line: &str) -> Option<serde_json::Value> {
    if line.trim().is_empty() {
        return None;
    }
    let value = serde_json::from_str::<serde_json::Value>(line).ok()?;
    if value.get("timestamp").is_some() && value.get("level").is_some() {
        None
    } else {
        Some(value)
    }
}

fn message_matches_active_run(value: &serde_json::Value, turn_id: &str) -> bool {
    app_server_message_turn_id(value)
        .is_none_or(|message_turn_id| turn_id.is_empty() || message_turn_id == turn_id)
}

fn message_matches_active_turn(method: &str, value: &serde_json::Value, turn_id: &str) -> bool {
    app_server_message_turn_id(value).is_none_or(|message_turn_id| {
        if method == "turn/started" {
            turn_id.is_empty() || message_turn_id == turn_id
        } else {
            !turn_id.is_empty() && message_turn_id == turn_id
        }
    })
}

fn app_server_message_turn_id(value: &serde_json::Value) -> Option<String> {
    let params = value.get("params")?;
    params
        .get("turnId")
        .and_then(|value| value.as_str())
        .or_else(|| {
            params
                .get("turn")
                .and_then(|turn| turn.get("id"))
                .and_then(|value| value.as_str())
        })
        .filter(|id| !id.is_empty())
        .map(str::to_string)
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

#[cfg(all(test, unix))]
#[path = "app_server_tests.rs"]
mod tests;
