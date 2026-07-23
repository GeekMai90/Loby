//! [INPUT]: 依赖 serde/serde_json 与 BTreeMap，承接前端 camelCase command/event payload
//! [OUTPUT]: 向 crate 提供写作库模型、AgentChatStreamEvent 阶段耗时事件及 publishing 等跨领域受控契约
//! [POS]: native 共享基础层，为多个领域提供序列化、路径、Markdown 或系统能力
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PropertyOption {
    pub(crate) id: String,
    pub(crate) label: String,
    #[serde(default)]
    pub(crate) color: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProjectPropertyDefinition {
    pub(crate) id: String,
    pub(crate) key: String,
    pub(crate) label: String,
    #[serde(rename = "type")]
    pub(crate) field_type: String,
    #[serde(default)]
    pub(crate) description: String,
    #[serde(default)]
    pub(crate) options: Vec<PropertyOption>,
    #[serde(default)]
    pub(crate) default_value: Option<Value>,
    #[serde(default)]
    pub(crate) show_when_empty: bool,
    #[serde(default)]
    pub(crate) locked: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SheetVersion {
    pub(crate) id: String,
    pub(crate) title: String,
    pub(crate) body: String,
    pub(crate) created_at: String,
    pub(crate) word_count: u32,
    #[serde(default)]
    pub(crate) source: String,
    #[serde(default)]
    pub(crate) reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WritingSheet {
    pub(crate) id: String,
    pub(crate) title: String,
    #[serde(default)]
    pub(crate) group_id: String,
    pub(crate) status: String,
    pub(crate) target_words: u32,
    pub(crate) summary: String,
    pub(crate) body: String,
    #[serde(default)]
    pub(crate) created_at: String,
    pub(crate) updated_at: String,
    #[serde(default)]
    pub(crate) properties: BTreeMap<String, Value>,
    #[serde(default)]
    pub(crate) archived_at: String,
    #[serde(default)]
    pub(crate) completed_at: String,
    #[serde(default)]
    pub(crate) versions: Vec<SheetVersion>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProjectGroup {
    pub(crate) id: String,
    pub(crate) title: String,
    #[serde(default)]
    pub(crate) icon: String,
    #[serde(default)]
    pub(crate) icon_color: String,
    #[serde(default)]
    pub(crate) description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PublishingChecklistItem {
    pub(crate) id: String,
    pub(crate) label: String,
    pub(crate) done: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ExportHistoryItem {
    pub(crate) id: String,
    pub(crate) label: String,
    pub(crate) filename: String,
    pub(crate) path: String,
    pub(crate) exported_at: String,
    pub(crate) sheet_count: u32,
    pub(crate) word_count: u32,
    pub(crate) target_platform: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProjectWritingBrief {
    #[serde(default)]
    pub(crate) audience: String,
    #[serde(default)]
    pub(crate) thesis: String,
    #[serde(default)]
    pub(crate) tone: String,
    #[serde(default)]
    pub(crate) publishing_notes: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProjectGoal {
    #[serde(default)]
    pub(crate) enabled: bool,
    #[serde(default = "default_project_goal_unit")]
    pub(crate) unit: String,
    #[serde(default)]
    pub(crate) target: u32,
}

impl Default for ProjectGoal {
    fn default() -> Self {
        Self {
            enabled: false,
            unit: default_project_goal_unit(),
            target: 0,
        }
    }
}

fn default_project_goal_unit() -> String {
    "words".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WritingProject {
    pub(crate) id: String,
    pub(crate) title: String,
    #[serde(default)]
    pub(crate) icon: String,
    #[serde(default)]
    pub(crate) icon_color: String,
    pub(crate) description: String,
    pub(crate) status: String,
    pub(crate) target_platform: String,
    pub(crate) target_words: u32,
    #[serde(default)]
    pub(crate) project_goal: ProjectGoal,
    pub(crate) tags: Vec<String>,
    #[serde(default)]
    pub(crate) groups: Vec<ProjectGroup>,
    pub(crate) sheets: Vec<WritingSheet>,
    pub(crate) updated_at: String,
    #[serde(default)]
    pub(crate) property_definitions: Vec<ProjectPropertyDefinition>,
    #[serde(default)]
    pub(crate) archived_at: String,
    #[serde(default)]
    pub(crate) publishing_checklist: Vec<PublishingChecklistItem>,
    #[serde(default)]
    pub(crate) export_history: Vec<ExportHistoryItem>,
    #[serde(default)]
    pub(crate) writing_brief: ProjectWritingBrief,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TrashEntry {
    pub(crate) id: String,
    pub(crate) kind: String,
    pub(crate) title: String,
    pub(crate) deleted_at: u64,
    #[serde(default)]
    pub(crate) project_id: String,
    #[serde(default)]
    pub(crate) project_title: String,
    #[serde(default)]
    pub(crate) sheet_id: String,
    #[serde(default)]
    pub(crate) group_id: String,
    #[serde(default)]
    pub(crate) original_path: String,
    #[serde(default)]
    pub(crate) body: String,
    #[serde(default)]
    pub(crate) trash_path: String,
    #[serde(default)]
    pub(crate) size_bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct EmptySheetCleanupResult {
    pub(crate) projects: Vec<WritingProject>,
    pub(crate) removed_count: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct UnusedImageCandidate {
    pub(crate) name: String,
    pub(crate) path: String,
    pub(crate) size_bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct UnusedImageCleanupResult {
    pub(crate) moved_count: usize,
    pub(crate) skipped_count: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CodexSkill {
    pub(crate) id: String,
    pub(crate) name: String,
    pub(crate) description: String,
    pub(crate) path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CodexSkillInstruction {
    pub(crate) path: String,
    pub(crate) instructions: String,
    pub(crate) truncated: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CodexReasoningLevel {
    pub(crate) effort: String,
    pub(crate) description: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CodexServiceTier {
    pub(crate) id: String,
    pub(crate) name: String,
    pub(crate) description: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CodexModelOption {
    pub(crate) slug: String,
    pub(crate) display_name: String,
    pub(crate) description: String,
    pub(crate) default_reasoning_level: String,
    pub(crate) supported_reasoning_levels: Vec<CodexReasoningLevel>,
    pub(crate) additional_speed_tiers: Vec<String>,
    pub(crate) service_tiers: Vec<CodexServiceTier>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CodexModelCatalog {
    pub(crate) fetched_at: String,
    pub(crate) current_model: String,
    pub(crate) current_reasoning_effort: String,
    pub(crate) models: Vec<CodexModelOption>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CodexChatResult {
    pub(crate) output: String,
    pub(crate) error: String,
    pub(crate) command: String,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentRuntimeSettings {
    #[serde(default)]
    pub(crate) model: String,
    #[serde(default)]
    pub(crate) reasoning_effort: String,
    #[serde(default)]
    pub(crate) quick_mode: bool,
    #[serde(default)]
    pub(crate) execution_mode: String,
    #[serde(default)]
    pub(crate) use_plugin_capabilities: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentUsage {
    pub(crate) input_tokens: u64,
    pub(crate) cached_input_tokens: u64,
    pub(crate) output_tokens: u64,
    pub(crate) reasoning_output_tokens: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentChatStreamEvent {
    pub(crate) request_id: String,
    pub(crate) kind: String,
    pub(crate) text: String,
    pub(crate) error: String,
    #[serde(skip_serializing_if = "String::is_empty")]
    pub(crate) raw_type: String,
    #[serde(skip_serializing_if = "String::is_empty")]
    pub(crate) item_id: String,
    #[serde(skip_serializing_if = "String::is_empty")]
    pub(crate) item_type: String,
    #[serde(skip_serializing_if = "String::is_empty")]
    pub(crate) status: String,
    #[serde(skip_serializing_if = "String::is_empty")]
    pub(crate) title: String,
    #[serde(skip_serializing_if = "String::is_empty")]
    pub(crate) command: String,
    #[serde(skip_serializing_if = "String::is_empty")]
    pub(crate) output: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) exit_code: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) usage: Option<AgentUsage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) elapsed_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CodexProbeStep {
    pub(crate) name: String,
    pub(crate) ok: bool,
    pub(crate) command: String,
    pub(crate) stdout: String,
    pub(crate) stderr: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CodexProbeResult {
    pub(crate) resolved_path: String,
    pub(crate) ok: bool,
    pub(crate) steps: Vec<CodexProbeStep>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProjectResourceFile {
    pub(crate) kind: String,
    pub(crate) name: String,
    pub(crate) path: String,
    pub(crate) size_bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct LibraryImageCentralizationResult {
    pub(crate) source_path: String,
    pub(crate) destination_path: String,
    pub(crate) status: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AiAttachment {
    pub(crate) id: String,
    pub(crate) name: String,
    pub(crate) path: String,
    pub(crate) mime_type: String,
    pub(crate) size_bytes: u64,
    pub(crate) kind: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProjectResourceText {
    pub(crate) path: String,
    pub(crate) name: String,
    pub(crate) status: String,
    pub(crate) content: String,
    pub(crate) size_bytes: u64,
    pub(crate) truncated: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProjectExportBundleFile {
    pub(crate) relative_path: String,
    pub(crate) content: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProjectExportBundleAsset {
    pub(crate) source_path: String,
    pub(crate) relative_path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ImportedMarkdownFile {
    pub(crate) name: String,
    pub(crate) path: String,
    pub(crate) content: String,
    pub(crate) size_bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct LibraryFileChange {
    pub(crate) paths: Vec<String>,
    pub(crate) kind: String,
}
