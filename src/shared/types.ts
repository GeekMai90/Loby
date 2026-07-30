/**
 * [INPUT]: 依赖 同目录稳定契约
 * [OUTPUT]: 对外提供写作、项目发布目标绑定、GitHub/微信公众号发布身份、AI runtime、活动生命周期、AiAttachment、会话、正文审阅与应用设置等跨 feature 稳定契约
 * [POS]: shared 层的共享领域契约，连接 app 与各 feature
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
export type ProjectStatus = "构思" | "初稿" | "修改中" | "待配图" | "待发布" | "已发布" | "已归档";

export type PropertyFieldType = "text" | "number" | "checkbox" | "date" | "url" | "select" | "multiSelect" | "tags";

export type MetadataValue = string | number | boolean | null | MetadataValue[] | { [key: string]: MetadataValue };

export interface PropertyOption {
  id: string;
  label: string;
  color?: string;
}

export interface DocumentPropertyDefinition {
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

export type AgentProvider =
  "openai-api" | "anthropic-api" | "qwen-api" | "minimax-api" | "deepseek-api" | "kimi-api" | "openai-compatible" | "chatgpt-subscription";

export type ImageGenerationProvider = "auto" | "chatgpt-subscription" | "openai-api";

export type AssistantSendMode = "enter" | "mod-enter";

export type AssistantPresentation = "floating" | "docked";

export type AgentModel = string;

export type AgentReasoningEffort = string;

export interface AgentRuntimeSettings {
  model: AgentModel;
  reasoningEffort: AgentReasoningEffort;
  quickMode: boolean;
  executionMode?: "interactive" | "autonomous-read";
  baseUrl?: string;
  imageGenerationProvider?: ImageGenerationProvider;
}

export interface AgentCredentialStatus {
  provider: string;
  configured: boolean;
}

export interface ChatGptDeviceAuthorization {
  flowId: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
}

export interface ChatGptConnection {
  connected: boolean;
  planType: string;
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

export interface AgentRunCheckpoint {
  version: 1;
  requestId: string;
  conversationId: string;
  provider: string;
  prompt: string;
  status: "running" | "waitingForApproval" | "executingTool";
  toolName: string;
  reason: string;
  updatedAtMs: number;
}

export interface AgentReasoningLevel {
  effort: string;
  description: string;
}

export interface AgentServiceTier {
  id: string;
  name: string;
  description: string;
}

export interface AgentModelOption {
  slug: string;
  displayName: string;
  description: string;
  /** Loby 用于规划模型视图的保守上下文上限，不代表 Provider 的实时账户配额。 */
  contextWindowTokens: number;
  /** Provider 明确声明是否接受 reasoning effort；兼容服务不得由 Loby 猜测。 */
  supportsReasoning: boolean;
  defaultReasoningLevel: string;
  supportedReasoningLevels: AgentReasoningLevel[];
  additionalSpeedTiers: string[];
  serviceTiers: AgentServiceTier[];
}

export interface AgentModelCatalog {
  fetchedAt: string;
  currentModel: string;
  currentReasoningEffort: string;
  models: AgentModelOption[];
}

export type EditorFontPreset = "system" | "pingfang" | "songti" | "kaiti" | "lxgw-wenkai" | "huiwen-mincho" | "mono" | "custom";

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
  formatOnSave: boolean;
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
  tags: string[];
  targetWords: number;
  description: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  properties: Record<string, MetadataValue>;
  archivedAt?: string;
  versions?: SheetVersion[];
  publications?: Record<string, PublishingTargetPublication>;
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

interface PublishingTargetPublicationBase {
  sourceId: string;
  lastPublishedAt: string;
  sourceHash: string;
  draft: boolean;
}

export interface GitHubPublishingTargetPublication extends PublishingTargetPublicationBase {
  targetKind: "githubHugoBlog" | "githubDocsSite";
  slug: string;
  url: string;
  lastCommitSha: string;
}

export interface WechatDraftPublication extends PublishingTargetPublicationBase {
  targetKind: "wechatOfficialAccount";
  appId: string;
  mediaId: string;
  draft: true;
}

export type PublishingTargetPublication = GitHubPublishingTargetPublication | WechatDraftPublication;

export interface PublishingGroupMapping {
  groupId: string;
  directory: string;
  enabled: boolean;
}

export interface ProjectPublishingBinding {
  targetId: string;
  groupMappings: PublishingGroupMapping[];
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
  status: ProjectStatus;
  projectGoal?: ProjectGoal;
  groups?: ProjectGroup[];
  sheets: WritingSheet[];
  updatedAt: string;
  documentPropertyDefinitions?: DocumentPropertyDefinition[];
  archivedAt?: string;
  publishingChecklist?: PublishingChecklistItem[];
  exportHistory?: ExportHistoryItem[];
  writingBrief?: ProjectWritingBrief;
  publishingBinding?: ProjectPublishingBinding;
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

export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  path: string;
  source: "builtin" | "library";
  compatibility: AgentSkillCompatibility;
  enabled: boolean;
  diagnostics: AgentSkillDiagnostic[];
  resourceCount: number;
  hasScripts: boolean;
  instructions?: string;
  instructionsTruncated?: boolean;
}

export type AgentSkillCompatibility = "compatible" | "adaptation-required" | "unsupported";

export interface AgentSkillDiagnostic {
  level: "info" | "warning" | "error";
  code: string;
  message: string;
}

export interface AgentSkillImportPreview {
  sourcePath: string;
  name: string;
  description: string;
  compatibility: AgentSkillCompatibility;
  diagnostics: AgentSkillDiagnostic[];
  files: string[];
  hasScripts: boolean;
}

export interface AgentSkillDraft {
  name: string;
  description: string;
  instructions: string;
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

export interface McpServerConfig {
  id: string;
  name: string;
  enabled: boolean;
  transport: "stdio" | "streamable-http";
  command: string;
  args: string[];
  url: string;
  secretEnv: string;
}

export interface McpToolInfo {
  serverId: string;
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  readOnly: boolean;
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

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  attachments?: AiAttachment[];
  command?: string;
  run?: AgentRunInfo;
  contexts?: ChatContextPreview[];
  changeSets?: AiChangeSet[];
  actions?: AiAction[];
}

export type AgentConversationRole = "user" | "assistant";

export interface AgentConversationMessage {
  id: string;
  role: AgentConversationRole;
  content: string;
}

export interface ConversationCompactionCheckpoint {
  version: 1;
  id: string;
  createdAt: string;
  sourceMessageIds: string[];
  retainedMessageIds: string[];
  /** 模型可见语义的稳定指纹；旧 checkpoint 缺失时必须重建。 */
  sourceFingerprint?: string;
  summary: string;
  estimatedTokens: number;
}

export interface ConversationContextStats {
  contextWindowTokens: number;
  inputBudgetTokens: number;
  estimatedInputTokens: number;
  stableContextTokens: number;
  historyTokens: number;
  retainedMessageCount: number;
  compactedMessageCount: number;
}

export interface AiAttachment {
  id: string;
  name: string;
  path: string;
  mimeType: string;
  sizeBytes: number;
  kind: "image" | "document";
  previewUrl?: string;
}

export type AiImageAttachment = AiAttachment & { kind: "image" };

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

export type AgentActivityKind =
  | "context"
  | "reasoning"
  | "modelResponse"
  | "skill"
  | "tool"
  | "webSearch"
  | "imageGeneration"
  | "approval"
  | "proposal"
  | "fileChange"
  | "command"
  | "status"
  | "unknown";

export type AgentActivityState = "queued" | "running" | "awaitingApproval" | "completed" | "failed" | "cancelled" | "unknown";

export type AgentActivityVisibility = "milestone" | "detail" | "diagnostic";

export type AgentRunPhase =
  | "preparingContext"
  | "waitingForModel"
  | "reasoning"
  | "executingTool"
  | "waitingForApproval"
  | "streamingAnswer"
  | "finalizing"
  | "completed"
  | "failed"
  | "cancelled";

export interface AgentRunActivity {
  id: string;
  /** 新事件的稳定动作类型；旧会话缺失时由展示边界从 rawType/title 兼容推导。 */
  kind?: AgentActivityKind;
  /** 新事件的标准生命周期；status 保留为旧会话和 Provider 原始状态的兼容字段。 */
  state?: AgentActivityState;
  /** milestone/detail 进入用户轨迹，diagnostic 只供开发诊断；旧会话由展示边界补齐。 */
  visibility?: AgentActivityVisibility;
  /** Runtime 分配的全局单调序号；用于拒绝迟到事件，不要求同一请求连续。 */
  sequence?: number;
  emittedAtMs?: number;
  parentId?: string;
  rawType: string;
  title: string;
  status: string;
  toolName?: string;
  command: string;
  output: string;
  text: string;
  exitCode: number | null;
  artifactPath?: string;
}

export interface AgentRunTimings {
  runtimeReadyMs?: number;
  firstTextDeltaMs?: number;
  completedMs?: number;
}

export interface AgentRunInfo {
  schemaVersion?: 2;
  status: "running" | "completed" | "error" | "cancelled";
  /** 折叠摘要的唯一事实来源；旧会话缺失时才允许兼容推导。 */
  phase?: AgentRunPhase;
  activeActivityId?: string;
  lastSequence?: number;
  activities: AgentRunActivity[];
  usage: AgentUsage | null;
  timings?: AgentRunTimings;
  error?: string;
}

export interface ChatConversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  /** 当前对话的临时模型选择；新对话从应用默认值初始化，不反向改写设置。 */
  agentSelection?: AgentConversationSelection;
  /** 编辑历史消息会创建新分支；原会话保持不可变。 */
  parentConversationId?: string;
  forkedFromMessageId?: string;
  checkpoint?: ConversationCompactionCheckpoint;
  lastContextStats?: ConversationContextStats;
  lastUserMessageAt?: string;
  lastContextSheetId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentConversationSelection {
  provider: AgentProvider;
  model: AgentModel;
  reasoningEffort: AgentReasoningEffort;
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
  wholeLine?: boolean;
  baseFrom?: number;
  baseTo?: number;
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

export type AiActionType = "createSheet" | "insertText" | "insertImage" | "insertImages" | "saveExport";

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
      description: string;
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
  sourceArtifactPath?: string;
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
