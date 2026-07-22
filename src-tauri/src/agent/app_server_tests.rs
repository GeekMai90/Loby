//! [INPUT]: 依赖同模块 CodexAppServerState 与 active turn 过滤器、Unix 临时可执行脚本
//! [OUTPUT]: 提供 app-server 连接复用、死亡连接重建与跨 turn 事件隔离回归覆盖
//! [POS]: 本地 AI agent 领域的 app-server 白盒测试模块，与生产传输循环分文件但共享私有边界
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use super::{message_matches_active_turn, CodexAppServerState};
use std::fs;
use std::os::unix::fs::PermissionsExt;

#[test]
fn reuses_an_initialized_app_server_connection() -> Result<(), String> {
    let directory = tempfile::tempdir().map_err(|error| error.to_string())?;
    let starts_path = directory.path().join("starts.log");
    let script_path = directory.path().join("fake-codex");
    let script = format!(
        "#!/bin/sh\nprintf 'started\\n' >> '{}'\nwhile IFS= read -r line; do\n  case \"$line\" in\n    *'\"method\":\"initialize\"'*) printf '%s\\n' '{{\"id\":1,\"result\":{{}}}}' ;;\n  esac\ndone\n",
        starts_path.display()
    );
    fs::write(&script_path, script).map_err(|error| error.to_string())?;
    let mut permissions = fs::metadata(&script_path)
        .map_err(|error| error.to_string())?
        .permissions();
    permissions.set_mode(0o755);
    fs::set_permissions(&script_path, permissions).map_err(|error| error.to_string())?;

    let state = CodexAppServerState::default();
    let agent_path = script_path.display().to_string();
    let (first, first_reused) = state.acquire(&agent_path)?;
    let first_pid = first.child.id();
    assert!(!first_reused);
    state.release(first);

    let (mut second, second_reused) = state.acquire(&agent_path)?;
    assert!(second_reused);
    assert_eq!(second.child.id(), first_pid);
    second.child.kill().map_err(|error| error.to_string())?;
    second.child.wait().map_err(|error| error.to_string())?;
    state.release(second);

    let (third, third_reused) = state.acquire(&agent_path)?;
    assert!(!third_reused);
    state.release(third);

    let starts = fs::read_to_string(starts_path).map_err(|error| error.to_string())?;
    assert_eq!(starts.lines().count(), 2);
    Ok(())
}

#[test]
fn rejects_stale_turn_events_before_the_current_turn_is_known() {
    let stale_completed = serde_json::json!({
        "method": "turn/completed",
        "params": {
            "threadId": "thread-1",
            "turn": { "id": "turn-old" },
        },
    });
    let current_started = serde_json::json!({
        "method": "turn/started",
        "params": {
            "threadId": "thread-1",
            "turn": { "id": "turn-new" },
        },
    });

    assert!(!message_matches_active_turn(
        "turn/completed",
        &stale_completed,
        ""
    ));
    assert!(message_matches_active_turn(
        "turn/started",
        &current_started,
        "turn-new"
    ));
    assert!(!message_matches_active_turn(
        "turn/completed",
        &stale_completed,
        "turn-new"
    ));
}
