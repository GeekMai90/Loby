//! [INPUT]: 依赖同模块 CodexAppServerState、active turn 过滤器、thread/read 恢复解析器与 Unix 临时可执行脚本
//! [OUTPUT]: 提供连接复用、死亡连接重建、跨 turn 隔离与流事件丢失恢复回归覆盖
//! [POS]: 本地 AI agent 领域的 app-server 白盒测试模块，与生产传输循环分文件但共享私有边界
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use super::{
    matches_pending_request, message_matches_active_run, message_matches_active_turn,
    CodexAppServerState,
};
use crate::agent::events::app_server_image_artifact_path;
use crate::agent::turn_recovery::{recover_turn_from_thread_read, TurnRecovery};
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

#[test]
fn accepts_matching_turn_even_when_thread_metadata_drifts() {
    let approval = serde_json::json!({
        "method": "item/commandExecution/requestApproval",
        "params": {
            "threadId": "thread-reported-by-server",
            "turnId": "turn-current",
        },
    });

    assert!(message_matches_active_run(&approval, "turn-current"));
    assert!(!message_matches_active_run(&approval, "turn-other"));
}

#[test]
fn does_not_treat_notifications_as_absent_optional_responses() {
    assert!(!matches_pending_request(None, None));
    assert!(!matches_pending_request(None, Some(7)));
    assert!(!matches_pending_request(Some(7), None));
    assert!(matches_pending_request(Some(7), Some(7)));
    assert!(!matches_pending_request(Some(8), Some(7)));
}

#[test]
fn recovers_completed_agent_message_from_thread_read() {
    let response = serde_json::json!({
        "result": {
            "thread": {
                "turns": [{
                    "id": "turn-current",
                    "status": "completed",
                    "items": [
                        { "type": "userMessage", "id": "user-1", "content": [] },
                        { "type": "agentMessage", "id": "assistant-1", "text": "你好，我在。", "phase": "final_answer" }
                    ]
                }]
            }
        }
    });

    assert_eq!(
        recover_turn_from_thread_read(&response, "turn-current"),
        TurnRecovery::Completed {
            item_id: "assistant-1".to_string(),
            text: "你好，我在。".to_string(),
            items: vec![
                serde_json::json!({ "type": "userMessage", "id": "user-1", "content": [] }),
                serde_json::json!({ "type": "agentMessage", "id": "assistant-1", "text": "你好，我在。", "phase": "final_answer" }),
            ],
        }
    );
}

#[test]
fn exposes_pending_reasoning_items_before_the_turn_completes() {
    let response = serde_json::json!({
        "result": {
            "thread": {
                "turns": [{
                    "id": "turn-current",
                    "status": "inProgress",
                    "items": [{ "type": "reasoning", "id": "reasoning-1", "summary": [], "content": [] }]
                }]
            }
        }
    });

    assert_eq!(
        recover_turn_from_thread_read(&response, "turn-current"),
        TurnRecovery::Pending {
            items: vec![serde_json::json!({
                "type": "reasoning",
                "id": "reasoning-1",
                "summary": [],
                "content": []
            })],
        }
    );
}

#[test]
fn recovers_completed_image_artifact_without_final_text() {
    let response = serde_json::json!({
        "result": {
            "thread": {
                "turns": [{
                    "id": "turn-current",
                    "status": "completed",
                    "items": [
                        { "type": "userMessage", "id": "user-1", "content": [] },
                        {
                            "type": "imageGeneration",
                            "id": "image-1",
                            "status": "completed",
                            "savedPath": "/Users/example/.codex/generated_images/image-1.png"
                        }
                    ]
                }]
            }
        }
    });

    let TurnRecovery::Completed { text, items, .. } =
        recover_turn_from_thread_read(&response, "turn-current")
    else {
        panic!("completed image generation should be a successful recovery");
    };

    assert!(text.is_empty());
    assert_eq!(items.len(), 2);
    assert_eq!(
        app_server_image_artifact_path(&items[1]),
        "/Users/example/.codex/generated_images/image-1.png"
    );
}

#[test]
fn keeps_empty_completed_turn_without_artifact_as_failure() {
    let response = serde_json::json!({
        "result": {
            "thread": {
                "turns": [{
                    "id": "turn-current",
                    "status": "completed",
                    "items": [{ "type": "userMessage", "id": "user-1", "content": [] }]
                }]
            }
        }
    });

    assert_eq!(
        recover_turn_from_thread_read(&response, "turn-current"),
        TurnRecovery::Failed("Codex 已完成，但没有返回最终回复。".to_string())
    );
}
