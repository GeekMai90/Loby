//! [INPUT]: 依赖 Codex `thread/read(includeTurns)` JSON-RPC response 与当前 turn/已流式文本
//! [OUTPUT]: 向 agent transport 提供 TurnRecovery、recover_turn_from_thread_read 与 recovery_delta
//! [POS]: 本地 AI agent 领域的完成态对账器，在 app-server notification 丢失时恢复最终回复而不重复已收到文本
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md

#[derive(Debug, PartialEq, Eq)]
pub(super) enum TurnRecovery {
    Pending,
    Completed { item_id: String, text: String },
    Failed(String),
}

pub(super) fn recover_turn_from_thread_read(
    value: &serde_json::Value,
    turn_id: &str,
) -> TurnRecovery {
    let Some(turn) = value
        .get("result")
        .and_then(|result| result.get("thread"))
        .and_then(|thread| thread.get("turns"))
        .and_then(|turns| turns.as_array())
        .and_then(|turns| {
            turns
                .iter()
                .find(|turn| turn.get("id").and_then(|id| id.as_str()) == Some(turn_id))
        })
    else {
        return TurnRecovery::Pending;
    };

    match turn.get("status").and_then(|status| status.as_str()) {
        Some("completed") => completed_turn(turn),
        Some("failed") => TurnRecovery::Failed(
            turn.get("error")
                .and_then(|error| error.get("message"))
                .and_then(|message| message.as_str())
                .unwrap_or("Codex 本轮执行失败。")
                .to_string(),
        ),
        Some("interrupted") => TurnRecovery::Failed("Codex 本轮已中断。".to_string()),
        _ => TurnRecovery::Pending,
    }
}

pub(super) fn recovery_delta<'a>(streamed: &str, recovered: &'a str) -> Option<&'a str> {
    if recovered.is_empty() || recovered == streamed {
        return None;
    }
    if streamed.is_empty() {
        return Some(recovered);
    }
    recovered
        .strip_prefix(streamed)
        .filter(|suffix| !suffix.is_empty())
}

fn completed_turn(turn: &serde_json::Value) -> TurnRecovery {
    let Some(item) = turn
        .get("items")
        .and_then(|items| items.as_array())
        .and_then(|items| {
            items.iter().rev().find(|item| {
                item.get("type").and_then(|kind| kind.as_str()) == Some("agentMessage")
                    && item
                        .get("phase")
                        .and_then(|phase| phase.as_str())
                        .is_none_or(|phase| phase == "final_answer")
            })
        })
    else {
        return TurnRecovery::Failed("Codex 已完成，但没有返回最终回复。".to_string());
    };

    TurnRecovery::Completed {
        item_id: item
            .get("id")
            .and_then(|id| id.as_str())
            .unwrap_or("recovered-agent-message")
            .to_string(),
        text: item
            .get("text")
            .and_then(|text| text.as_str())
            .unwrap_or_default()
            .to_string(),
    }
}
