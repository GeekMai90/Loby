export type ProjectStatus = "构思" | "初稿" | "修改中" | "待配图" | "待发布" | "已发布" | "已归档";

export type PropertyFieldType = "text" | "number" | "checkbox" | "date" | "url" | "select" | "multiSelect" | "tags";

export type MetadataValue = string | number | boolean | null | MetadataValue[] | { [key: string]: MetadataValue };

export interface PropertyOption {
  id: string;
  label: string;
  color?: string;
}

export interface ProjectPropertyDefinition {
  id: string;
  key: string;
  label: string;
  type: PropertyFieldType;
  description?: string;
  options?: PropertyOption[];
  defaultValue?: MetadataValue;
  /** Legacy persisted setting. All project properties are now always visible. */
  showWhenEmpty?: boolean;
  locked?: boolean;
}

export type AgentProvider = "codex" | "claude";

export type AssistantSendMode = "enter" | "mod-enter";

export type AgentModel = string;

export type AgentReasoningEffort = string;

export interface AgentRuntimeSettings {
  model: AgentModel;
  reasoningEffort: AgentReasoningEffort;
  quickMode: boolean;
  executionMode?: "interactive" | "autonomous-read";
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

export type AppThemePreference = "system" | "light" | "dark";

export type ResolvedAppTheme = "light" | "dark";

export type EditorThemeId = "loby" | "graphite" | "vue" | "lapis";

export interface WritingLibrary {
  id: string;
  name: string;
  path: string;
  createdAt: number;
  lastOpenedAt: number;
  lastProjectId?: string;
  lastSheetId?: string;
}

export interface WritingLibraryRegistry {
  version: 1;
  activeLibraryId: string;
  libraries: WritingLibrary[];
}

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

export interface MarkdownFormattingSettings {
  cleanupWhitespace: boolean;
  normalizeBlockSpacing: boolean;
  normalizeMarkdownMarkers: boolean;
  spaceCjkAndLatin: boolean;
  fullWidthPunctuation: boolean;
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
  source?: "manual" | "auto" | "ai" | "restore";
  reason?: string;
}

export interface WritingSheet {
  id: string;
  title: string;
  groupId?: string;
  status: ProjectStatus;
  targetWords: number;
  summary: string;
  body: string;
  createdAt?: string;
  updatedAt: string;
  properties?: Record<string, MetadataValue>;
  archivedAt?: string;
  completedAt?: string;
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

export type ProjectGoalUnit = "words" | "articles";

export interface ProjectGoal {
  enabled: boolean;
  unit: ProjectGoalUnit;
  target: number;
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
  projectGoal?: ProjectGoal;
  tags: string[];
  groups?: ProjectGroup[];
  sheets: WritingSheet[];
  updatedAt: string;
  propertyDefinitions?: ProjectPropertyDefinition[];
  archivedAt?: string;
  publishingChecklist?: PublishingChecklistItem[];
  exportHistory?: ExportHistoryItem[];
  writingBrief?: ProjectWritingBrief;
}

export interface WritingCheckIn {
  date: string;
  projectId: string;
  projectTitle: string;
  sheetId: string;
  sheetTitle: string;
  goalAchieved?: boolean;
}

export interface WritingActivityStore {
  version: 1;
  checkIns: WritingCheckIn[];
  celebratedTargets: Record<string, number[]>;
}

export interface LibraryPreferences {
  version: 1;
  lastProjectId: string;
  lastSheetId: string;
  focusMode: boolean;
  typewriterMode: boolean;
  sheetPreviewMode: boolean;
  goalCelebrationEnabled: boolean;
  appTheme: AppThemePreference;
  editorTheme: EditorThemeId;
  editorTypography: EditorTypographySettings;
  imageReferenceFormat: ImageReferenceFormat;
  markdownFormatting: MarkdownFormattingSettings;
  activeGroupIdsByProject: Record<string, string>;
  sheetSortPreferences: Record<string, SheetSortPreference>;
  sheetManualOrders: SheetManualOrders;
}

export interface TrashEntry {
  id: string;
  kind: "project" | "document" | "image";
  title: string;
  deletedAt: number;
  projectId: string;
  projectTitle: string;
  sheetId: string;
  groupId: string;
  originalPath: string;
  body: string;
  trashPath: string;
  sizeBytes: number;
}

export interface UnusedImageCandidate {
  name: string;
  path: string;
  sizeBytes: number;
}

export interface CodexSkill {
  id: string;
  name: string;
  description: string;
  path: string;
  instructions?: string;
  instructionsTruncated?: boolean;
}

export interface AiQuickPrompt {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiQuickPromptStore {
  version: 1;
  prompts: AiQuickPrompt[];
}

export interface CodexProbeStep {
  name: string;
  ok: boolean;
  command: string;
  stdout: string;
  stderr: string;
}

export interface CodexCliProbeSnapshot {
  resolvedPath: string;
  ok: boolean;
}

export interface CodexProbeResult extends CodexCliProbeSnapshot {
  steps: CodexProbeStep[];
}

export interface ProjectResourceFile {
  kind: "asset" | "reference" | "export";
  name: string;
  path: string;
  sizeBytes: number;
}

export interface LibraryImageCentralizationResult {
  sourcePath: string;
  destinationPath: string;
  status: "transferred" | "missing";
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
  images?: AiImageAttachment[];
  command?: string;
  run?: AgentRunInfo;
  contexts?: ChatContextPreview[];
  changeSets?: AiChangeSet[];
  actions?: AiAction[];
}

export interface AiImageAttachment {
  id: string;
  name: string;
  path: string;
  mimeType: string;
  sizeBytes: number;
  previewUrl?: string;
}

export interface ChatContextPreview {
  id: string;
  type: "document" | "selection";
  contentMode?: "live" | "snapshot";
  sheetId?: string;
  projectId?: string;
  title: string;
  subtitle: string;
  excerpt: string;
  content?: string;
  visible?: boolean;
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

export type AiChangeSetStatus = "pending" | "partiallyAccepted" | "accepted" | "rejected";

export type AiChangeBlockStatus = "pending" | "accepted" | "rejected";

export interface AiChangeAnchor {
  before?: string;
  after?: string;
  startLine?: number;
  endLine?: number;
  from?: number;
  to?: number;
}

export interface AiChangeBlock {
  id: string;
  status: AiChangeBlockStatus;
  fromText: string;
  toText: string;
  reason?: string;
  anchor: AiChangeAnchor;
}

export interface AiChangeSet {
  id: string;
  sheetId: string;
  status: AiChangeSetStatus;
  createdAt: string;
  summary: string;
  baseBody: string;
  proposedBody: string;
  changes: AiChangeBlock[];
  error?: string;
}

export type AiActionType = "createSheet" | "insertText" | "insertImage" | "saveExport";

export type AiActionStatus = "proposed" | "applying" | "applied" | "rejected" | "failed" | "reverted";

export type AiActionEffect =
  | {
      type: "sheetVersionRestore";
      sheetId: string;
      sheetTitle: string;
      versionId: string;
      appliedBody?: string;
    }
  | {
      type: "createdSheet";
      projectId: string;
      sheetId: string;
      sheetTitle: string;
      summary: string;
      body: string;
      targetWords: number;
    };

export interface AiAction {
  id: string;
  type: AiActionType;
  status: AiActionStatus;
  title: string;
  summary: string;
  payload: Record<string, unknown>;
  createdAt: string;
  targetProjectId?: string;
  targetProjectTitle?: string;
  targetSheetId?: string;
  targetSheetTitle?: string;
  result?: string;
  error?: string;
  effect?: AiActionEffect;
}

export interface AiDocumentReference {
  id: string;
  projectId: string;
  sheetId: string;
  title: string;
  subtitle: string;
  status: ProjectStatus;
  summary: string;
  content: string;
}

export type MentionMode = "current-sheet" | "project-outline" | "all-sheets" | "selection";

export interface DiffLine {
  id: string;
  kind: "same" | "added" | "removed";
  text: string;
}
