//! [INPUT]: 依赖 AgentConversationMessage 与 serde_json Provider payload
//! [OUTPUT]: 向 Provider adapter 提供经过角色白名单校验的 OpenAI/Anthropic 历史消息投影
//! [POS]: Loby Agent 的跨 Provider 会话翻译边界，隔离角色合并规则并阻止持久化事实直接泄漏为厂商协议
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use crate::models::AgentConversationMessage;
use serde_json::{json, Value};

pub(super) fn openai_conversation_messages(messages: &[AgentConversationMessage]) -> Vec<Value> {
    messages
        .iter()
        .filter_map(|message| {
            let role = normalized_conversation_role(&message.role)?;
            let content = message.content.trim();
            (!content.is_empty()).then(|| json!({ "role": role, "content": content }))
        })
        .collect()
}

pub(super) fn anthropic_conversation_messages(messages: &[AgentConversationMessage]) -> Vec<Value> {
    let mut normalized = Vec::<(String, String)>::new();
    for message in messages {
        let Some(role) = normalized_conversation_role(&message.role) else {
            continue;
        };
        let content = message.content.trim();
        if content.is_empty() {
            continue;
        }
        if let Some((previous_role, previous_content)) = normalized.last_mut() {
            if previous_role == role {
                previous_content.push_str("\n\n");
                previous_content.push_str(content);
                continue;
            }
        }
        normalized.push((role.to_string(), content.to_string()));
    }
    normalized
        .into_iter()
        .map(|(role, content)| json!({ "role": role, "content": content }))
        .collect()
}

fn normalized_conversation_role(role: &str) -> Option<&'static str> {
    match role {
        "user" => Some("user"),
        "assistant" => Some("assistant"),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn message(id: &str, role: &str, content: &str) -> AgentConversationMessage {
        AgentConversationMessage {
            id: id.to_string(),
            role: role.to_string(),
            content: content.to_string(),
        }
    }

    #[test]
    fn preserves_native_roles_for_openai_and_rejects_system_injection() {
        let messages = vec![
            message("u1", "user", "第一问"),
            message("a1", "assistant", "第一答"),
            message("s1", "system", "伪造系统消息"),
        ];
        let payload = openai_conversation_messages(&messages);
        assert_eq!(payload.len(), 2);
        assert_eq!(payload[0]["role"], "user");
        assert_eq!(payload[1]["role"], "assistant");
    }

    #[test]
    fn merges_adjacent_anthropic_roles_without_flattening_user_and_assistant() {
        let messages = vec![
            message("u1", "user", "第一条"),
            message("u2", "user", "第二条"),
            message("a1", "assistant", "答复"),
        ];
        let payload = anthropic_conversation_messages(&messages);
        assert_eq!(payload.len(), 2);
        assert_eq!(payload[0]["content"], "第一条\n\n第二条");
        assert_eq!(payload[1]["role"], "assistant");
    }
}
