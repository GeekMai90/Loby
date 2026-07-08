export type ProjectStatus =
  | "构思"
  | "初稿"
  | "修改中"
  | "待配图"
  | "待发布"
  | "已发布"
  | "已归档";

export type SheetType = "正文" | "章节" | "提纲" | "素材" | "发布版本";

export type AgentProvider = "codex" | "claude";

export type AgentModel = string;

export type AgentReasoningEffort = string;

export interface AgentRuntimeSettings {
  model: AgentModel;
  reasoningEffort: AgentReasoningEffort;
  quickMode: boolean;
}

export interface AgentUsage {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningOutputTokens: number;
}

export type AgentApprovalDecision = "accept" | "acceptForSession" | "decline" | "cancel";

export type AgentApprovalStatus = "pending" | AgentApprovalDecision;

export interface AgentApprovalRequest {
  id: string;
  assistantMessageId: string;
  title: string;
  command: string;
  reason: string;
  status: AgentApprovalStatus;
}

export interface CodexReasoningLevel {
  effort: string;
  description: string;
}

export interface CodexServiceTier {
  id: string;
  name: string;
  description: string;
}

export interface CodexModelOption {
  slug: string;
  displayName: string;
  description: string;
  defaultReasoningLevel: string;
  supportedReasoningLevels: CodexReasoningLevel[];
  additionalSpeedTiers: string[];
  serviceTiers: CodexServiceTier[];
}

export interface CodexModelCatalog {
  fetchedAt: string;
  currentModel: string;
  currentReasoningEffort: string;
  models: CodexModelOption[];
}

export type EditorFontPreset = "system" | "pingfang" | "songti" | "kaiti" | "lxgw-wenkai" | "huiwen-mincho" | "mono" | "custom";

export type ImageReferenceFormat = "markdown" | "obsidian";

export interface EditorTypographySettings {
  fontPreset: EditorFontPreset;
  customFontFamily: string;
  lineHeight: number;
  paragraphSpacing: number;
  bodyFontSize: number;
  h1FontSize: number;
  h2FontSize: number;
  h3FontSize: number;
  tableFontSize: number;
}

export type SheetView = "列表" | "卡片" | "大纲";

export type SidebarMode = "library" | "project";

export type SheetSortMode = "manual" | "title" | "updated" | "created";

export type SheetSortDirection = "asc" | "desc";

export interface SheetSortPreference {
  mode: SheetSortMode;
  direction: SheetSortDirection;
}

export type SheetManualOrders = Record<string, string[]>;

export interface SheetDropTarget {
  sheetId: string;
  position: "before" | "after";
}

export interface SheetVersion {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  wordCount: number;
}

export interface WritingSheet {
  id: string;
  title: string;
  groupId?: string;
  type: SheetType;
  status: ProjectStatus;
  targetWords: number;
  summary: string;
  body: string;
  createdAt?: string;
  updatedAt: string;
  versions?: SheetVersion[];
}

export interface ProjectGroup {
  id: string;
  title: string;
  icon?: string;
  iconColor?: string;
  description?: string;
}

export interface PublishingChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export interface ExportHistoryItem {
  id: string;
  label: string;
  filename: string;
  path: string;
  exportedAt: string;
  sheetCount: number;
  wordCount: number;
  targetPlatform: string;
}

export interface ProjectWritingBrief {
  audience: string;
  thesis: string;
  tone: string;
  publishingNotes: string;
}

export interface WritingProject {
  id: string;
  title: string;
  icon?: string;
  iconColor?: string;
  description: string;
  status: ProjectStatus;
  targetPlatform: string;
  targetWords: number;
  tags: string[];
  groups?: ProjectGroup[];
  sheets: WritingSheet[];
  updatedAt: string;
  publishingChecklist?: PublishingChecklistItem[];
  exportHistory?: ExportHistoryItem[];
  writingBrief?: ProjectWritingBrief;
}

export interface CodexSkill {
  id: string;
  name: string;
  description: string;
  path: string;
}

export interface CodexProbeStep {
  name: string;
  ok: boolean;
  command: string;
  stdout: string;
  stderr: string;
}

export interface CodexProbeResult {
  resolvedPath: string;
  ok: boolean;
  steps: CodexProbeStep[];
}

export interface ProjectResourceFile {
  kind: "asset" | "reference" | "export";
  name: string;
  path: string;
  sizeBytes: number;
}

export interface ProjectResourceText {
  path: string;
  name: string;
  status: string;
  content: string;
  sizeBytes: number;
  truncated: boolean;
}

export interface ImportedMarkdownFile {
  name: string;
  path: string;
  content: string;
  sizeBytes: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  command?: string;
  run?: AgentRunInfo;
}

export interface AgentRunActivity {
  id: string;
  rawType: string;
  title: string;
  status: string;
  command: string;
  output: string;
  text: string;
  exitCode: number | null;
}

export interface AgentRunInfo {
  status: "running" | "completed" | "error" | "cancelled";
  activities: AgentRunActivity[];
  usage: AgentUsage | null;
  error?: string;
}

export interface ChatConversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  agentThreadId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiMountedContext {
  id: string;
  type: "document" | "selection";
  sheetId: string;
  projectId?: string;
  title: string;
  subtitle: string;
  content: string;
}

export interface AiDocumentReference {
  id: string;
  projectId: string;
  sheetId: string;
  title: string;
  subtitle: string;
  type: SheetType;
  status: ProjectStatus;
  summary: string;
  content: string;
}

export type MentionMode = "current-sheet" | "project-outline" | "all-sheets" | "selection" | "materials";

export interface DiffLine {
  id: string;
  kind: "same" | "added" | "removed";
  text: string;
}
