//! [INPUT]: 依赖 Codex `thread/read(includeTurns)` JSON-RPC response 与当前 turn/已流式文本
//! [OUTPUT]: 向 agent transport 提供 TurnRecovery 与 recover_turn_from_thread_read
//! [POS]: 本地 AI agent 领域的快照对账器，在 app-server notification 丢失时恢复进行中里程碑与最终文字/图片成果
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md

use super::rollout_recovery::recover_rollout_activity_items;

#[derive(Debug, PartialEq, Eq)]
pub(super) enum TurnRecovery {
    Pending {
        items: Vec<serde_json::Value>,
    },
    Completed {
        item_id: String,
        text: String,
        items: Vec<serde_json::Value>,
    },
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
        return TurnRecovery::Pending { items: Vec::new() };
    };

    match turn.get("status").and_then(|status| status.as_str()) {
        Some("completed") => completed_turn(value, turn, turn_id),
        Some("failed") => TurnRecovery::Failed(
            turn.get("error")
                .and_then(|error| error.get("message"))
                .and_then(|message| message.as_str())
                .unwrap_or("Codex 本轮执行失败。")
                .to_string(),
        ),
        Some("interrupted") => TurnRecovery::Failed("Codex 本轮已中断。".to_string()),
        _ => TurnRecovery::Pending {
            items: recovered_turn_items(value, turn, turn_id),
        },
    }
}

fn completed_turn(
    response: &serde_json::Value,
    turn: &serde_json::Value,
    turn_id: &str,
) -> TurnRecovery {
    let items = recovered_turn_items(response, turn, turn_id);
    let final_message = items.iter().rev().find(|item| {
        item.get("type").and_then(|kind| kind.as_str()) == Some("agentMessage")
            && item
                .get("phase")
                .and_then(|phase| phase.as_str())
                .is_none_or(|phase| phase == "final_answer")
    });
    let text = final_message
        .and_then(|item| item.get("text"))
        .and_then(|text| text.as_str())
        .unwrap_or_default()
        .to_string();
    let has_image_artifact = items.iter().any(|item| {
        item.get("type").and_then(|kind| kind.as_str()) == Some("imageGeneration")
            && item
                .get("savedPath")
                .or_else(|| item.get("saved_path"))
                .and_then(|path| path.as_str())
                .is_some_and(|path| !path.trim().is_empty())
    });
    if text.trim().is_empty() && !has_image_artifact {
        return TurnRecovery::Failed("Codex 已完成，但没有返回最终回复。".to_string());
    }

    TurnRecovery::Completed {
        item_id: final_message
            .and_then(|item| item.get("id"))
            .and_then(|id| id.as_str())
            .unwrap_or("recovered-agent-message")
            .to_string(),
        text,
        items,
    }
}

fn recovered_turn_items(
    response: &serde_json::Value,
    turn: &serde_json::Value,
    turn_id: &str,
) -> Vec<serde_json::Value> {
    let mut items = recover_rollout_activity_items(response, turn_id);
    items.extend(
        turn.get("items")
            .and_then(|items| items.as_array())
            .cloned()
            .unwrap_or_default(),
    );
    items
}

pub(super) fn is_final_agent_message_item(item: &serde_json::Value) -> bool {
    item.get("type").and_then(|kind| kind.as_str()) == Some("agentMessage")
        && item
            .get("phase")
            .and_then(|phase| phase.as_str())
            .is_none_or(|phase| phase == "final_answer")
}
