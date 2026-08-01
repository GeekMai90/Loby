//! [INPUT]: 依赖 serde/serde_json 与 BTreeMap，承接前端 camelCase command/event payload
//! [OUTPUT]: 向 crate 提供含文稿收藏状态且无文稿系统状态的写作库契约、单文稿保存回执、带输入指纹的发布记录、Agent Skill 诊断、含 Provider 能力声明和图片服务偏好的 runtime、带封闭 kind/sequence/权威生命周期的 Agent 事件及 publishing 等跨领域受控契约
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
pub(crate) struct DocumentPropertyDefinition {
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
    pub(crate) favorite: bool,
    #[serde(default)]
    pub(crate) group_id: String,
    #[serde(default, rename = "status", skip_serializing)]
    pub(crate) legacy_status: String,
    #[serde(default)]
    pub(crate) tags: Vec<String>,
    pub(crate) target_words: u32,
    #[serde(default, alias = "summary")]
    pub(crate) description: String,
    pub(crate) body: String,
    #[serde(default)]
    pub(crate) created_at: String,
    pub(crate) updated_at: String,
    #[serde(default)]
    pub(crate) properties: BTreeMap<String, Value>,
    #[serde(default)]
    pub(crate) archived_at: String,
    #[serde(default)]
    pub(crate) versions: Vec<SheetVersion>,
    #[serde(default)]
    pub(crate) publications: BTreeMap<String, PublishingTargetPublication>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PublishingTargetPublication {
    #[serde(default = "default_github_hugo_blog_kind")]
    pub(crate) target_kind: String,
    #[serde(default)]
    pub(crate) source_id: String,
    #[serde(default)]
    pub(crate) slug: String,
    #[serde(default)]
    pub(crate) url: String,
    #[serde(default)]
    pub(crate) last_commit_sha: String,
    #[serde(default)]
    pub(crate) last_published_at: String,
    #[serde(default)]
    pub(crate) source_hash: String,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub(crate) source_revision: String,
    #[serde(default)]
    pub(crate) draft: bool,
    #[serde(default)]
    pub(crate) app_id: String,
    #[serde(default)]
    pub(crate) media_id: String,
}

fn default_github_hugo_blog_kind() -> String {
    "githubHugoBlog".to_string()
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

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PublishingGroupMapping {
    pub(crate) group_id: String,
    pub(crate) directory: String,
    #[serde(default)]
    pub(crate) enabled: bool,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProjectPublishingBinding {
    #[serde(default)]
    pub(crate) target_id: String,
    #[serde(default)]
    pub(crate) group_mappings: Vec<PublishingGroupMapping>,
}

pub(crate) fn legacy_docs_target_id(project_id: &str) -> String {
    let suffix = project_id
        .trim()
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || matches!(character, '-' | '_') {
                character
            } else {
                '-'
            }
        })
        .collect::<String>();
    format!("github-docs-{}", suffix.trim_matches('-'))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DocumentProjectContext {
    pub(crate) id: String,
    pub(crate) title: String,
    #[serde(default)]
    pub(crate) groups: Vec<ProjectGroup>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DocumentSaveReceipt {
    pub(crate) path: String,
    pub(crate) revision: u64,
    pub(crate) written: bool,
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
    pub(crate) status: String,
    #[serde(default)]
    pub(crate) project_goal: ProjectGoal,
    #[serde(default)]
    pub(crate) groups: Vec<ProjectGroup>,
    pub(crate) sheets: Vec<WritingSheet>,
    pub(crate) updated_at: String,
    #[serde(default)]
    pub(crate) document_property_definitions: Vec<DocumentPropertyDefinition>,
    #[serde(default)]
    pub(crate) archived_at: String,
    #[serde(default)]
    pub(crate) publishing_checklist: Vec<PublishingChecklistItem>,
    #[serde(default)]
    pub(crate) export_history: Vec<ExportHistoryItem>,
    #[serde(default)]
    pub(crate) writing_brief: ProjectWritingBrief,
    #[serde(default)]
    pub(crate) publishing_binding: Option<ProjectPublishingBinding>,
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
pub(crate) struct AgentSkill {
    pub(crate) id: String,
    pub(crate) name: String,
    pub(crate) description: String,
    pub(crate) path: String,
    pub(crate) source: String,
    pub(crate) compatibility: String,
    pub(crate) enabled: bool,
    pub(crate) diagnostics: Vec<AgentSkillDiagnostic>,
    pub(crate) resource_count: usize,
    pub(crate) has_scripts: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentSkillDiagnostic {
    pub(crate) level: String,
    pub(crate) code: String,
    pub(crate) message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentSkillImportPreview {
    pub(crate) source_path: String,
    pub(crate) name: String,
    pub(crate) description: String,
    pub(crate) compatibility: String,
    pub(crate) diagnostics: Vec<AgentSkillDiagnostic>,
    pub(crate) files: Vec<String>,
    pub(crate) has_scripts: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentSkillDraft {
    pub(crate) name: String,
    pub(crate) description: String,
    pub(crate) instructions: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentSkillInstruction {
    pub(crate) path: String,
    pub(crate) instructions: String,
    pub(crate) truncated: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentReasoningLevel {
    pub(crate) effort: String,
    pub(crate) description: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentServiceTier {
    pub(crate) id: String,
    pub(crate) name: String,
    pub(crate) description: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentModelOption {
    pub(crate) slug: String,
    pub(crate) display_name: String,
    pub(crate) description: String,
    pub(crate) context_window_tokens: u64,
    pub(crate) supports_reasoning: bool,
    pub(crate) default_reasoning_level: String,
    pub(crate) supported_reasoning_levels: Vec<AgentReasoningLevel>,
    pub(crate) additional_speed_tiers: Vec<String>,
    pub(crate) service_tiers: Vec<AgentServiceTier>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentModelCatalog {
    pub(crate) fetched_at: String,
    pub(crate) current_model: String,
    pub(crate) current_reasoning_effort: String,
    pub(crate) models: Vec<AgentModelOption>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentChatResult {
    pub(crate) output: String,
    pub(crate) error: String,
    pub(crate) command: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentConversationMessage {
    pub(crate) id: String,
    pub(crate) role: String,
    pub(crate) content: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentCredentialStatus {
    pub(crate) provider: String,
    pub(crate) configured: bool,
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
    pub(crate) max_output_tokens: Option<u32>,
    #[serde(default)]
    pub(crate) execution_mode: String,
    #[serde(default)]
    pub(crate) base_url: String,
    #[serde(default)]
    pub(crate) image_generation_provider: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentUsage {
    pub(crate) input_tokens: u64,
    pub(crate) cached_input_tokens: u64,
    pub(crate) output_tokens: u64,
    pub(crate) reasoning_output_tokens: u64,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) enum AgentActivityKind {
    Reasoning,
    Skill,
    Tool,
    WebSearch,
    ImageGeneration,
    Approval,
    Proposal,
    Status,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) enum AgentActivityState {
    Queued,
    Running,
    AwaitingApproval,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) enum AgentActivityVisibility {
    Milestone,
    Detail,
    Diagnostic,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) enum AgentRunPhase {
    WaitingForModel,
    Reasoning,
    ExecutingTool,
    WaitingForApproval,
    StreamingAnswer,
    Finalizing,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) enum AgentStreamEventKind {
    Started,
    State,
    Delta,
    Message,
    Activity,
    Approval,
    Proposal,
    Usage,
    Metric,
    Done,
    Error,
    Cancelled,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentChatStreamEvent {
    pub(crate) request_id: String,
    pub(crate) sequence: u64,
    pub(crate) emitted_at_ms: u64,
    pub(crate) kind: AgentStreamEventKind,
    pub(crate) text: String,
    pub(crate) error: String,
    #[serde(skip_serializing_if = "String::is_empty")]
    pub(crate) raw_type: String,
    #[serde(skip_serializing_if = "String::is_empty")]
    pub(crate) item_id: String,
    #[serde(skip_serializing_if = "String::is_empty")]
    pub(crate) item_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) activity_kind: Option<AgentActivityKind>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) activity_state: Option<AgentActivityState>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) visibility: Option<AgentActivityVisibility>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) run_phase: Option<AgentRunPhase>,
    #[serde(skip_serializing_if = "String::is_empty")]
    pub(crate) active_item_id: String,
    #[serde(skip_serializing_if = "String::is_empty")]
    pub(crate) parent_id: String,
    #[serde(skip_serializing_if = "String::is_empty")]
    pub(crate) phase: String,
    #[serde(skip_serializing_if = "String::is_empty")]
    pub(crate) status: String,
    #[serde(skip_serializing_if = "String::is_empty")]
    pub(crate) title: String,
    #[serde(skip_serializing_if = "String::is_empty")]
    pub(crate) command: String,
    #[serde(skip_serializing_if = "String::is_empty")]
    pub(crate) output: String,
    #[serde(skip_serializing_if = "String::is_empty")]
    pub(crate) artifact_path: String,
    #[serde(skip_serializing_if = "String::is_empty")]
    pub(crate) proposal_kind: String,
    #[serde(skip_serializing_if = "String::is_empty")]
    pub(crate) tool_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) payload: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) exit_code: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) usage: Option<AgentUsage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) elapsed_ms: Option<u64>,
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
pub(crate) struct LibraryFileChange {
    pub(crate) paths: Vec<String>,
    pub(crate) kind: String,
}
