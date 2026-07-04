export type ProjectStatus =
  | "构思"
  | "初稿"
  | "修改中"
  | "待配图"
  | "待发布"
  | "已发布"
  | "已归档";

export type SheetType = "正文" | "章节" | "提纲" | "素材" | "发布版本";

export type InspectorTab = "信息" | "AI" | "资源" | "历史" | "导出";

export type SheetView = "列表" | "卡片" | "大纲";

export type SidebarMode = "library" | "project";

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
  updatedAt: string;
  versions?: SheetVersion[];
}

export interface ProjectGroup {
  id: string;
  title: string;
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

export interface AiSuggestion {
  id: string;
  title: string;
  source: string;
  result: string;
  scope: "selection" | "sheet" | "project";
  reviewMode?: "diff" | "note";
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
}

export interface ChatConversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export type MentionMode = "current-sheet" | "project-outline" | "all-sheets" | "selection" | "materials";

export interface DiffLine {
  id: string;
  kind: "same" | "added" | "removed";
  text: string;
}
