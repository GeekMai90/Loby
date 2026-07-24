//! [INPUT]: 依赖 Codex thread/read 返回的 rollout path、当前 turn id 与本地 JSONL 记录
//! [OUTPUT]: 向 turn_recovery 提供去重后的高层 reasoning/exec/wait 活动 item
//! [POS]: 本地 AI agent 的诊断恢复边界，补齐 thread/read 完成快照省略的用户可见运行里程碑
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md

use std::collections::HashSet;
use std::fs::File;
use std::io::{BufRead, BufReader};

const MAX_RECOVERED_ITEMS: usize = 256;

pub(super) fn recover_rollout_activity_items(
    response: &serde_json::Value,
    turn_id: &str,
) -> Vec<serde_json::Value> {
    let Some(thread) = response
        .get("result")
        .and_then(|result| result.get("thread"))
    else {
        return Vec::new();
    };
    let Some(path) = thread.get("path").and_then(|path| path.as_str()) else {
        return Vec::new();
    };
    let existing_ids = thread
        .get("turns")
        .and_then(|turns| turns.as_array())
        .into_iter()
        .flatten()
        .filter(|turn| turn.get("id").and_then(|id| id.as_str()) == Some(turn_id))
        .flat_map(|turn| turn.get("items").and_then(|items| items.as_array()))
        .flatten()
        .filter_map(|item| item.get("id").and_then(|id| id.as_str()))
        .map(str::to_string)
        .collect::<HashSet<_>>();
    let Ok(file) = File::open(path) else {
        return Vec::new();
    };
    parse_rollout_activity_items(BufReader::new(file), turn_id, &existing_ids)
}

fn parse_rollout_activity_items(
    reader: impl BufRead,
    turn_id: &str,
    existing_ids: &HashSet<String>,
) -> Vec<serde_json::Value> {
    let mut active_turn = false;
    let mut reasoning_recovered = false;
    let mut items = Vec::new();

    for line in reader.lines().map_while(Result::ok) {
        if items.len() >= MAX_RECOVERED_ITEMS {
            break;
        }
        if !line.contains("\"type\":\"turn_context\"")
            && !line.contains("\"type\":\"reasoning\"")
            && !line.contains("\"type\":\"custom_tool_call\"")
            && !line.contains("\"type\":\"function_call\"")
        {
            continue;
        }
        let Ok(record) = serde_json::from_str::<serde_json::Value>(&line) else {
            continue;
        };
        if record.get("type").and_then(|kind| kind.as_str()) == Some("turn_context") {
            active_turn = record
                .get("payload")
                .and_then(|payload| payload.get("turn_id"))
                .and_then(|id| id.as_str())
                == Some(turn_id);
            continue;
        }
        if !active_turn
            || record.get("type").and_then(|kind| kind.as_str()) != Some("response_item")
        {
            continue;
        }
        let Some(payload) = record.get("payload") else {
            continue;
        };
        match payload.get("type").and_then(|kind| kind.as_str()) {
            Some("reasoning") if !reasoning_recovered => {
                reasoning_recovered = true;
                items.push(serde_json::json!({
                    "type": "reasoning",
                    "id": payload.get("id").and_then(|id| id.as_str()).unwrap_or("recovered-reasoning"),
                    "status": "completed",
                    "message": "分析任务并整理执行方案。"
                }));
            }
            Some("custom_tool_call") => push_tool_item(payload, "input", existing_ids, &mut items),
            Some("function_call") => push_tool_item(payload, "arguments", existing_ids, &mut items),
            _ => {}
        }
    }
    items
}

fn push_tool_item(
    payload: &serde_json::Value,
    input_key: &str,
    existing_ids: &HashSet<String>,
    items: &mut Vec<serde_json::Value>,
) {
    let id = payload
        .get("call_id")
        .or_else(|| payload.get("id"))
        .and_then(|id| id.as_str())
        .unwrap_or_default();
    if id.is_empty() || existing_ids.contains(id) {
        return;
    }
    let tool = payload
        .get("name")
        .and_then(|name| name.as_str())
        .unwrap_or("tool");
    let arguments = payload.get(input_key).cloned().unwrap_or_default();
    items.push(serde_json::json!({
        "type": "dynamicToolCall",
        "id": id,
        "tool": tool,
        "arguments": arguments,
        "status": "completed"
    }));
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    #[test]
    fn recovers_one_reasoning_step_and_all_tool_calls_for_the_target_turn() {
        let jsonl = [
            r#"{"type":"turn_context","payload":{"turn_id":"turn-current"}}"#,
            r#"{"type":"response_item","payload":{"type":"reasoning","id":"reason-1"}}"#,
            r#"{"type":"response_item","payload":{"type":"reasoning","id":"reason-2"}}"#,
            r#"{"type":"response_item","payload":{"type":"custom_tool_call","name":"exec","call_id":"call-skill","input":"read SKILL.md"}}"#,
            r#"{"type":"response_item","payload":{"type":"function_call","name":"wait","call_id":"call-wait","arguments":"{}"}}"#,
        ]
        .join("\n");

        let items =
            parse_rollout_activity_items(Cursor::new(jsonl), "turn-current", &HashSet::new());

        assert_eq!(items.len(), 3);
        assert_eq!(
            items[0].get("type").and_then(|value| value.as_str()),
            Some("reasoning")
        );
        assert_eq!(
            items[1].get("id").and_then(|value| value.as_str()),
            Some("call-skill")
        );
        assert_eq!(
            items[2].get("tool").and_then(|value| value.as_str()),
            Some("wait")
        );
    }
}
