//! [INPUT]: 依赖 Agent ToolDefinition、serde_json 与 Loby 文稿动作字段约束
//! [OUTPUT]: 向 Agent Loop 提供跨 Provider 稳定的文稿提案工具定义、受控 JSON 对象归一化、缺省展示字段收敛、运行内插入意图保护与封闭 payload 校验
//! [POS]: 本地 AI agent 的作者控制边界；模型只能提出结构化修改，且精确插入意图不能静默降级为文末写入
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use super::tools::{ToolDefinition, ToolEffect};
use serde_json::{json, Value};
use std::collections::HashSet;

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

#[derive(Debug, Default)]
pub(super) struct ProposalRunPolicy {
    anchored_image_paths: HashSet<String>,
}

impl ProposalRunPolicy {
    pub(super) fn reset(&mut self) {
        self.anchored_image_paths.clear();
    }

    pub(super) fn normalize(
        &mut self,
        name: &str,
        arguments: &Value,
    ) -> Result<AgentProposal, String> {
        let mut arguments = normalize_top_level_arguments(arguments)?;
        normalize_provider_omissions(name, &mut arguments);
        let image_path = image_path(name, &arguments);
        let target = arguments["target"].as_str().unwrap_or_default();
        if target == "anchor" {
            if let Some(path) = image_path.as_ref() {
                self.anchored_image_paths.insert(path.clone());
            }
        } else if matches!(target, "cursor" | "selection" | "end")
            && image_path
                .as_ref()
                .is_some_and(|path| self.anchored_image_paths.contains(path))
        {
            return Err(
                "同一图片已经尝试精确定位，不能在定位失败后静默改用 cursor、selection 或 end；请修正 anchor，无法定位时应向用户说明。"
                    .to_string(),
            );
        }
        normalize_anchor_argument(&mut arguments)?;
        normalize_object(name, &arguments)
    }
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
                "required": ["title", "summary", "text", "target"],
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
                "required": ["title", "summary", "path", "format", "target"],
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

#[cfg(test)]
pub(super) fn normalize(name: &str, arguments: &Value) -> Result<AgentProposal, String> {
    let mut arguments = normalize_top_level_arguments(arguments)?;
    normalize_provider_omissions(name, &mut arguments);
    normalize_anchor_argument(&mut arguments)?;
    normalize_object(name, &arguments)
}

fn normalize_object(name: &str, arguments: &Value) -> Result<AgentProposal, String> {
    match name {
        PROPOSE_INSERT_TEXT => {
            ensure_only_fields(arguments, &["title", "summary", "text", "target", "anchor"])?;
            required_text(arguments, "title", 200)?;
            bounded_text(arguments, "summary", 2_000)?;
            required_large_text(arguments, "text")?;
            validate_target(arguments)?;
            Ok(action_proposal("生成插入文本确认", arguments))
        }
        PROPOSE_CREATE_SHEET => {
            ensure_only_fields(arguments, &["title", "summary", "description", "body"])?;
            required_text(arguments, "title", 200)?;
            bounded_text(arguments, "summary", 2_000)?;
            bounded_text(arguments, "description", 20_000)?;
            bounded_large_text(arguments, "body")?;
            Ok(action_proposal("生成新建文稿确认", arguments))
        }
        PROPOSE_INSERT_IMAGE => {
            ensure_only_fields(
                arguments,
                &[
                    "title", "summary", "path", "alt", "format", "target", "anchor",
                ],
            )?;
            required_text(arguments, "title", 200)?;
            bounded_text(arguments, "summary", 2_000)?;
            required_text(arguments, "path", 8_192)?;
            bounded_text(arguments, "alt", 1_000)?;
            validate_enum(arguments, "format", &["markdown", "obsidian"])?;
            validate_target(arguments)?;
            Ok(action_proposal("生成插入图片确认", arguments))
        }
        PROPOSE_SAVE_EXPORT => {
            ensure_only_fields(
                arguments,
                &["title", "summary", "filename", "content", "format"],
            )?;
            required_text(arguments, "title", 200)?;
            bounded_text(arguments, "summary", 2_000)?;
            let filename = required_text(arguments, "filename", 255)?;
            if filename.contains('/') || filename.contains('\\') || matches!(filename, "." | "..") {
                return Err("导出文件名不能包含路径。".to_string());
            }
            required_large_text(arguments, "content")?;
            validate_enum(arguments, "format", &["markdown", "html", "text", "json"])?;
            Ok(action_proposal("生成保存导出确认", arguments))
        }
        PROPOSE_DOCUMENT_CHANGE => {
            ensure_only_fields(arguments, &["summary", "proposedBody"])?;
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

fn ensure_only_fields(arguments: &Value, allowed: &[&str]) -> Result<(), String> {
    let object = arguments
        .as_object()
        .ok_or_else(|| "文稿提案参数必须是 JSON object。".to_string())?;
    if let Some(field) = object
        .keys()
        .find(|field| !allowed.contains(&field.as_str()))
    {
        return Err(format!("文稿提案包含未声明字段 {field}。"));
    }
    Ok(())
}

fn validate_enum(arguments: &Value, field: &str, allowed: &[&str]) -> Result<(), String> {
    let value = required_text(arguments, field, 32)?;
    allowed
        .contains(&value)
        .then_some(())
        .ok_or_else(|| format!("文稿提案字段 {field} 的取值无效。"))
}

fn proposal_tool(name: &str, description: &str, input_schema: Value) -> ToolDefinition {
    ToolDefinition {
        name: name.to_string(),
        display_name: name.to_string(),
        execution_name: None,
        description: description.to_string(),
        input_schema,
        effect: ToolEffect::Proposal,
    }
}

fn anchor_schema() -> Value {
    json!({
        "type": "object",
        "description": "仅当 target 为 anchor 时提供。按正文段落、标题或唯一文本精确定位；其他 target 省略该字段。",
        "properties": {
            "type": {
                "type": "string",
                "enum": ["paragraphFromStart", "paragraphFromEnd", "afterHeading", "beforeHeading", "afterText", "beforeText"]
            },
            "index": { "type": "integer", "minimum": 1 },
            "position": { "type": "string", "enum": ["before", "after"] },
            "text": { "type": "string" },
            "heading": { "type": "string" },
            "level": { "type": "integer", "minimum": 1, "maximum": 6 }
        },
        "required": ["type"],
        "additionalProperties": false
    })
}

fn normalize_top_level_arguments(arguments: &Value) -> Result<Value, String> {
    decode_json_object(arguments, "文稿提案参数")
}

fn normalize_provider_omissions(name: &str, arguments: &mut Value) {
    if name != PROPOSE_INSERT_IMAGE || !arguments["alt"].is_null() {
        return;
    }
    arguments["alt"] = json!(arguments["title"].as_str().unwrap_or_default());
}

fn normalize_anchor_argument(arguments: &mut Value) -> Result<(), String> {
    let Some(anchor) = arguments.get_mut("anchor") else {
        return Ok(());
    };
    let Some(encoded) = anchor.as_str() else {
        return Ok(());
    };
    let decoded = serde_json::from_str::<Value>(encoded)
        .map_err(|_| "文稿提案字段 anchor 包含无效 JSON。".to_string())?;
    if !decoded.is_object() && !decoded.is_null() {
        return Err("文稿提案字段 anchor 必须是 JSON object 或 null。".to_string());
    }
    *anchor = decoded;
    Ok(())
}

fn decode_json_object(value: &Value, label: &str) -> Result<Value, String> {
    if value.is_object() {
        return Ok(value.clone());
    }
    if let Some(encoded) = value.as_str() {
        let decoded = serde_json::from_str::<Value>(encoded)
            .map_err(|_| format!("{label}包含无效 JSON。"))?;
        if decoded.is_object() {
            return Ok(decoded);
        }
    }
    Err(format!("{label}必须是 JSON object。"))
}

fn image_path(name: &str, arguments: &Value) -> Option<String> {
    (name == PROPOSE_INSERT_IMAGE)
        .then(|| {
            arguments["path"]
                .as_str()
                .map(str::trim)
                .unwrap_or_default()
        })
        .filter(|path| !path.is_empty())
        .map(str::to_string)
}

fn validate_target(arguments: &Value) -> Result<(), String> {
    let target = required_text(arguments, "target", 32)?;
    if !matches!(target, "cursor" | "selection" | "end" | "anchor") {
        return Err("插入位置只允许 cursor、selection、end 或 anchor。".to_string());
    }
    if target == "anchor" {
        validate_anchor(&arguments["anchor"])?;
    }
    Ok(())
}

fn validate_anchor(anchor: &Value) -> Result<(), String> {
    if !anchor.is_object() {
        return Err("文稿提案字段 anchor 必须是 JSON object。".to_string());
    }
    ensure_only_fields(
        anchor,
        &["type", "index", "position", "text", "heading", "level"],
    )?;
    let anchor_type = required_text(anchor, "type", 32)?;
    if !matches!(
        anchor_type,
        "paragraphFromStart"
            | "paragraphFromEnd"
            | "afterHeading"
            | "beforeHeading"
            | "afterText"
            | "beforeText"
    ) {
        return Err("anchor.type 取值无效。".to_string());
    }
    if let Some(position) = anchor["position"].as_str() {
        if !matches!(position, "before" | "after") {
            return Err("anchor.position 只允许 before 或 after。".to_string());
        }
    }
    if let Some(index) = anchor["index"].as_u64() {
        if index == 0 {
            return Err("anchor.index 必须大于 0。".to_string());
        }
    } else if !anchor["index"].is_null() {
        return Err("anchor.index 必须是正整数或 null。".to_string());
    }
    if let Some(level) = anchor["level"].as_u64() {
        if !(1..=6).contains(&level) {
            return Err("anchor.level 只允许 1 到 6。".to_string());
        }
    } else if !anchor["level"].is_null() {
        return Err("anchor.level 必须是 1 到 6 的整数或 null。".to_string());
    }
    for field in ["text", "heading"] {
        if let Some(value) = anchor.get(field) {
            if !value.is_null()
                && (!value.is_string() || value.as_str().is_some_and(|text| text.len() > 8_192))
            {
                return Err(format!("anchor.{field} 必须是有界字符串或 null。"));
            }
        }
    }
    if anchor_type.starts_with("paragraph") && anchor["index"].as_u64().unwrap_or_default() == 0 {
        return Err("段落 anchor 必须提供正整数 index。".to_string());
    }
    if matches!(anchor_type, "afterHeading" | "beforeHeading")
        && anchor["heading"]
            .as_str()
            .unwrap_or_default()
            .trim()
            .is_empty()
        && anchor["text"]
            .as_str()
            .unwrap_or_default()
            .trim()
            .is_empty()
    {
        return Err("标题 anchor 必须提供 heading。".to_string());
    }
    if matches!(anchor_type, "afterText" | "beforeText")
        && anchor["text"]
            .as_str()
            .unwrap_or_default()
            .trim()
            .is_empty()
    {
        return Err("文本 anchor 必须提供 text。".to_string());
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
        definitions, normalize, ProposalKind, ProposalRunPolicy, ToolEffect, PROPOSE_CREATE_SHEET,
        PROPOSE_DOCUMENT_CHANGE, PROPOSE_INSERT_IMAGE, PROPOSE_INSERT_TEXT,
    };
    use serde_json::json;

    #[test]
    fn proposal_definitions_use_strict_closed_schemas() {
        let definitions = definitions();
        assert_eq!(definitions.len(), 5);
        assert!(definitions
            .iter()
            .all(|tool| tool.effect == ToolEffect::Proposal));
        assert!(definitions
            .iter()
            .all(|tool| tool.input_schema["additionalProperties"] == false));
    }

    #[test]
    fn insertion_anchor_schema_stays_simple_for_chat_completion_providers() {
        let definitions = definitions();
        let insert_image = definitions
            .iter()
            .find(|tool| tool.name == PROPOSE_INSERT_IMAGE)
            .unwrap();
        let required = insert_image.input_schema["required"].as_array().unwrap();
        assert!(!required.iter().any(|field| field == "anchor"));
        assert_eq!(
            insert_image.input_schema["properties"]["anchor"]["type"],
            "object"
        );
        assert!(insert_image.input_schema["properties"]["anchor"]
            .get("anyOf")
            .is_none());
        assert_eq!(
            insert_image.input_schema["properties"]["anchor"]["required"],
            json!(["type"])
        );
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
    fn proposal_runtime_rejects_undeclared_fields_and_invalid_enums() {
        assert!(normalize(
            PROPOSE_CREATE_SHEET,
            &json!({
                "title": "新文稿",
                "summary": "摘要",
                "description": "描述",
                "body": "正文",
                "groupId": "hidden-target"
            })
        )
        .is_err());
        assert!(normalize(
            PROPOSE_INSERT_IMAGE,
            &json!({
                "title": "插图",
                "summary": "摘要",
                "path": "assets/image.png",
                "alt": "配图",
                "format": "html",
                "target": "end",
                "anchor": null
            })
        )
        .is_err());
    }

    #[test]
    fn proposal_runtime_deeply_validates_anchor_objects() {
        let base = json!({
            "title": "插入段落",
            "summary": "摘要",
            "text": "正文",
            "target": "anchor"
        });
        let mut valid = base.clone();
        valid["anchor"] = json!({ "type": "afterHeading", "heading": "小结", "level": 2 });
        assert!(normalize(PROPOSE_INSERT_TEXT, &valid).is_ok());

        let mut invalid = base;
        invalid["anchor"] = json!({ "type": "afterHeading", "heading": "", "unexpected": true });
        assert!(normalize(PROPOSE_INSERT_TEXT, &invalid).is_err());
    }

    #[test]
    fn proposal_runtime_recovers_qwen_stringified_objects_without_weakening_validation() {
        let anchor = json!({
            "type": "beforeText",
            "text": "说回卢曼的卡片盒"
        })
        .to_string();
        let arguments = json!({
            "title": "插入小麦风格配图",
            "summary": "插入到卢曼段落之前",
            "path": "assets/images/wheat.png",
            "alt": "信息仓库与思考机器",
            "format": "markdown",
            "target": "anchor",
            "anchor": anchor
        });
        let proposal = normalize(PROPOSE_INSERT_IMAGE, &arguments).unwrap();
        assert_eq!(proposal.payload["anchor"]["type"], "beforeText");
        assert_eq!(proposal.payload["anchor"]["text"], "说回卢曼的卡片盒");

        let encoded_arguments = json!(arguments.to_string());
        assert!(normalize(PROPOSE_INSERT_IMAGE, &encoded_arguments).is_ok());
        assert!(normalize(PROPOSE_INSERT_IMAGE, &json!("[]")).is_err());
    }

    #[test]
    fn image_proposal_uses_title_when_minimax_omits_alt_text() {
        let proposal = normalize(
            PROPOSE_INSERT_IMAGE,
            &json!({
                "title": "信息仓库与思考机器",
                "summary": "插入到卢曼段落之前",
                "path": "assets/images/wheat.png",
                "format": "markdown",
                "target": "anchor",
                "anchor": {
                    "type": "beforeText",
                    "text": "说回卢曼的卡片盒"
                }
            }),
        )
        .unwrap();
        assert_eq!(proposal.payload["alt"], "信息仓库与思考机器");
    }

    #[test]
    fn proposal_policy_rejects_silent_fallback_from_anchor_to_document_end() {
        let path = "assets/images/wheat.png";
        let mut policy = ProposalRunPolicy::default();
        let invalid_anchor = json!({
            "title": "插入配图",
            "summary": "插入到卢曼段落之前",
            "path": path,
            "alt": "信息仓库与思考机器",
            "format": "markdown",
            "target": "anchor",
            "anchor": []
        });
        assert!(policy
            .normalize(PROPOSE_INSERT_IMAGE, &invalid_anchor)
            .is_err());

        let end_fallback = json!({
            "title": "插入配图",
            "summary": "插入到文稿末尾",
            "path": path,
            "alt": "信息仓库与思考机器",
            "format": "markdown",
            "target": "end"
        });
        let error = policy
            .normalize(PROPOSE_INSERT_IMAGE, &end_fallback)
            .unwrap_err();
        assert!(error.contains("不能在定位失败后静默改用 cursor、selection 或 end"));

        let corrected_anchor = json!({
            "title": "插入配图",
            "summary": "插入到卢曼段落之前",
            "path": path,
            "alt": "信息仓库与思考机器",
            "format": "markdown",
            "target": "anchor",
            "anchor": {
                "type": "beforeText",
                "text": "说回卢曼的卡片盒"
            }
        });
        assert!(policy
            .normalize(PROPOSE_INSERT_IMAGE, &corrected_anchor)
            .is_ok());

        policy.reset();
        assert!(policy
            .normalize(PROPOSE_INSERT_IMAGE, &end_fallback)
            .is_ok());
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
