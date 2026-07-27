//! [INPUT]: 依赖 Agent ToolDefinition、serde_json 与 Loby 文稿动作字段约束
//! [OUTPUT]: 向 Agent Loop 提供严格的文稿提案工具定义、类型识别和确定性 payload 校验
//! [POS]: 本地 AI agent 的作者控制边界；模型只能提出结构化修改，不能在工具调用阶段直接写正文
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use super::tools::ToolDefinition;
use serde_json::{json, Value};

const MAX_PROPOSAL_TEXT_BYTES: usize = 2 * 1024 * 1024;

pub(super) const PROPOSE_INSERT_TEXT: &str = "propose_insert_text";
pub(super) const PROPOSE_CREATE_SHEET: &str = "propose_create_sheet";
pub(super) const PROPOSE_INSERT_IMAGE: &str = "propose_insert_image";
pub(super) const PROPOSE_SAVE_EXPORT: &str = "propose_save_export";
pub(super) const PROPOSE_DOCUMENT_CHANGE: &str = "propose_document_change";

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) enum ProposalKind {
    DocumentAction,
    DocumentChange,
}

impl ProposalKind {
    pub(super) fn as_str(&self) -> &'static str {
        match self {
            Self::DocumentAction => "documentAction",
            Self::DocumentChange => "documentChange",
        }
    }
}

#[derive(Debug, Clone)]
pub(super) struct AgentProposal {
    pub(super) kind: ProposalKind,
    pub(super) title: String,
    pub(super) payload: Value,
}

pub(super) fn definitions() -> Vec<ToolDefinition> {
    vec![
        proposal_tool(
            PROPOSE_INSERT_TEXT,
            "提出向当前文稿插入 Markdown 文本的动作。用户明确要求插入、追加或替换选区时调用；该工具只生成确认卡片，不会直接修改正文。",
            json!({
                "type": "object",
                "properties": {
                    "title": { "type": "string", "minLength": 1 },
                    "summary": { "type": "string" },
                    "text": { "type": "string", "minLength": 1 },
                    "target": { "type": "string", "enum": ["cursor", "selection", "end", "anchor"] },
                    "anchor": anchor_schema()
                },
                "required": ["title", "summary", "text", "target", "anchor"],
                "additionalProperties": false
            }),
        ),
        proposal_tool(
            PROPOSE_CREATE_SHEET,
            "提出创建一篇独立 Markdown 文稿的动作。只有用户明确要求新建文稿时调用；该工具只生成确认卡片。",
            json!({
                "type": "object",
                "properties": {
                    "title": { "type": "string", "minLength": 1 },
                    "summary": { "type": "string" },
                    "description": { "type": "string" },
                    "body": { "type": "string" }
                },
                "required": ["title", "summary", "description", "body"],
                "additionalProperties": false
            }),
        ),
        proposal_tool(
            PROPOSE_INSERT_IMAGE,
            "提出把已经生成或导入的图片引用插入当前文稿的动作。只有用户明确要求插入图片时调用；path 必须是写作库相对路径或 http/https URL。",
            json!({
                "type": "object",
                "properties": {
                    "title": { "type": "string", "minLength": 1 },
                    "summary": { "type": "string" },
                    "path": { "type": "string", "minLength": 1 },
                    "alt": { "type": "string" },
                    "format": { "type": "string", "enum": ["markdown", "obsidian"] },
                    "target": { "type": "string", "enum": ["cursor", "selection", "end", "anchor"] },
                    "anchor": anchor_schema()
                },
                "required": ["title", "summary", "path", "alt", "format", "target", "anchor"],
                "additionalProperties": false
            }),
        ),
        proposal_tool(
            PROPOSE_SAVE_EXPORT,
            "提出把内容保存到当前项目 exports 目录的动作。只有用户明确要求保存或导出时调用；filename 只能是文件名。",
            json!({
                "type": "object",
                "properties": {
                    "title": { "type": "string", "minLength": 1 },
                    "summary": { "type": "string" },
                    "filename": { "type": "string", "minLength": 1 },
                    "content": { "type": "string", "minLength": 1 },
                    "format": { "type": "string", "enum": ["markdown", "html", "text", "json"] }
                },
                "required": ["title", "summary", "filename", "content", "format"],
                "additionalProperties": false
            }),
        ),
        proposal_tool(
            PROPOSE_DOCUMENT_CHANGE,
            "提出对当前文稿进行整篇或大段修改。用户要求改写、润色、重组或替换已有正文时调用；proposedBody 必须是修改后的完整正文。",
            json!({
                "type": "object",
                "properties": {
                    "summary": { "type": "string", "minLength": 1 },
                    "proposedBody": { "type": "string", "minLength": 1 }
                },
                "required": ["summary", "proposedBody"],
                "additionalProperties": false
            }),
        ),
    ]
}

pub(super) fn is_proposal_tool(name: &str) -> bool {
    matches!(
        name,
        PROPOSE_INSERT_TEXT
            | PROPOSE_CREATE_SHEET
            | PROPOSE_INSERT_IMAGE
            | PROPOSE_SAVE_EXPORT
            | PROPOSE_DOCUMENT_CHANGE
    )
}

pub(super) fn normalize(name: &str, arguments: &Value) -> Result<AgentProposal, String> {
    if !arguments.is_object() {
        return Err("文稿提案参数必须是 JSON object。".to_string());
    }
    match name {
        PROPOSE_INSERT_TEXT => {
            required_text(arguments, "title", 200)?;
            bounded_text(arguments, "summary", 2_000)?;
            required_large_text(arguments, "text")?;
            validate_target(arguments)?;
            Ok(action_proposal("生成插入文本确认", arguments))
        }
        PROPOSE_CREATE_SHEET => {
            required_text(arguments, "title", 200)?;
            bounded_text(arguments, "summary", 2_000)?;
            bounded_text(arguments, "description", 20_000)?;
            bounded_large_text(arguments, "body")?;
            Ok(action_proposal("生成新建文稿确认", arguments))
        }
        PROPOSE_INSERT_IMAGE => {
            required_text(arguments, "title", 200)?;
            bounded_text(arguments, "summary", 2_000)?;
            required_text(arguments, "path", 8_192)?;
            bounded_text(arguments, "alt", 1_000)?;
            validate_target(arguments)?;
            Ok(action_proposal("生成插入图片确认", arguments))
        }
        PROPOSE_SAVE_EXPORT => {
            required_text(arguments, "title", 200)?;
            bounded_text(arguments, "summary", 2_000)?;
            let filename = required_text(arguments, "filename", 255)?;
            if filename.contains('/') || filename.contains('\\') || matches!(filename, "." | "..") {
                return Err("导出文件名不能包含路径。".to_string());
            }
            required_large_text(arguments, "content")?;
            Ok(action_proposal("生成保存导出确认", arguments))
        }
        PROPOSE_DOCUMENT_CHANGE => {
            required_text(arguments, "summary", 2_000)?;
            required_large_text(arguments, "proposedBody")?;
            Ok(AgentProposal {
                kind: ProposalKind::DocumentChange,
                title: "生成正文修改建议".to_string(),
                payload: arguments.clone(),
            })
        }
        _ => Err(format!("未知文稿提案工具：{name}")),
    }
}

fn action_proposal(title: &str, arguments: &Value) -> AgentProposal {
    AgentProposal {
        kind: ProposalKind::DocumentAction,
        title: title.to_string(),
        payload: arguments.clone(),
    }
}

fn proposal_tool(name: &str, description: &str, input_schema: Value) -> ToolDefinition {
    ToolDefinition {
        name: name.to_string(),
        description: description.to_string(),
        input_schema,
        effect: "proposal".to_string(),
    }
}

fn anchor_schema() -> Value {
    json!({
        "anyOf": [
            { "type": "null" },
            {
                "type": "object",
                "properties": {
                    "type": {
                        "type": ["string", "null"],
                        "enum": ["paragraphFromStart", "paragraphFromEnd", "afterHeading", "beforeHeading", "afterText", "beforeText", null]
                    },
                    "index": { "type": ["integer", "null"], "minimum": 1 },
                    "position": { "type": ["string", "null"], "enum": ["before", "after", null] },
                    "text": { "type": ["string", "null"] },
                    "heading": { "type": ["string", "null"] },
                    "level": { "type": ["integer", "null"], "minimum": 1, "maximum": 6 }
                },
                "required": ["type", "index", "position", "text", "heading", "level"],
                "additionalProperties": false
            }
        ]
    })
}

fn validate_target(arguments: &Value) -> Result<(), String> {
    let target = required_text(arguments, "target", 32)?;
    if !matches!(target, "cursor" | "selection" | "end" | "anchor") {
        return Err("插入位置只允许 cursor、selection、end 或 anchor。".to_string());
    }
    if target == "anchor" && !arguments["anchor"].is_object() {
        return Err("anchor 插入必须提供 anchor object。".to_string());
    }
    Ok(())
}

fn required_large_text<'a>(value: &'a Value, field: &str) -> Result<&'a str, String> {
    let text = required_text(value, field, MAX_PROPOSAL_TEXT_BYTES)?;
    if text.is_empty() {
        return Err(format!("文稿提案缺少 {field}。"));
    }
    Ok(text)
}

fn bounded_large_text<'a>(value: &'a Value, field: &str) -> Result<&'a str, String> {
    bounded_text(value, field, MAX_PROPOSAL_TEXT_BYTES)
}

fn required_text<'a>(value: &'a Value, field: &str, max_bytes: usize) -> Result<&'a str, String> {
    let text = bounded_text(value, field, max_bytes)?;
    if text.trim().is_empty() {
        return Err(format!("文稿提案缺少 {field}。"));
    }
    Ok(text)
}

fn bounded_text<'a>(value: &'a Value, field: &str, max_bytes: usize) -> Result<&'a str, String> {
    let text = value[field]
        .as_str()
        .ok_or_else(|| format!("文稿提案字段 {field} 必须是 string。"))?;
    if text.len() > max_bytes {
        return Err(format!("文稿提案字段 {field} 超过大小限制。"));
    }
    Ok(text)
}

#[cfg(test)]
mod tests {
    use super::{
        definitions, normalize, ProposalKind, PROPOSE_DOCUMENT_CHANGE, PROPOSE_INSERT_TEXT,
    };
    use serde_json::json;

    #[test]
    fn proposal_definitions_use_strict_closed_schemas() {
        let definitions = definitions();
        assert_eq!(definitions.len(), 5);
        assert!(definitions.iter().all(|tool| tool.effect == "proposal"));
        assert!(definitions
            .iter()
            .all(|tool| tool.input_schema["additionalProperties"] == false));
    }

    #[test]
    fn insert_text_keeps_markdown_code_fences_as_structured_payload() {
        let proposal = normalize(
            PROPOSE_INSERT_TEXT,
            &json!({
                "title": "插入测试稿",
                "summary": "展示 Markdown 样式",
                "text": "# 标题\n\n```js\nconsole.log(1)\n```",
                "target": "cursor",
                "anchor": null
            }),
        )
        .unwrap();
        assert_eq!(proposal.kind, ProposalKind::DocumentAction);
        assert!(proposal.payload["text"].as_str().unwrap().contains("```js"));
    }

    #[test]
    fn document_change_requires_complete_proposed_body() {
        assert!(normalize(PROPOSE_DOCUMENT_CHANGE, &json!({ "summary": "润色" })).is_err());
        assert!(normalize(
            PROPOSE_DOCUMENT_CHANGE,
            &json!({ "summary": "润色", "proposedBody": "# 完整正文" })
        )
        .is_ok());
    }
}
