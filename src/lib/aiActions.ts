import type { AiAction, AiActionType } from "../types";

type ActionBlockKind = AiActionType | "generic";

interface ParsedActionPayload {
  action?: string;
  title?: string;
  summary?: string;
  payload?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface AiActionContext {
  projectId?: string;
  projectTitle?: string;
  sheetId?: string;
  sheetTitle?: string;
}

const ACTION_BLOCK_PATTERN =
  /```(?:loby-actions|loby-action|loby-create-sheet|loby-insert-text|loby-insert-image|loby-save-export)\s*([\s\S]*?)```/gi;
const ACTION_BLOCK_START_PATTERN =
  /```(?:loby-actions|loby-action|loby-create-sheet|loby-insert-text|loby-insert-image|loby-save-export)\b/i;
const ACTION_BLOCK_WITH_KIND_PATTERN =
  /```(loby-actions|loby-action|loby-create-sheet|loby-insert-text|loby-insert-image|loby-save-export)\s*([\s\S]*?)```/gi;

export function stripAiActionBlocks(message: string): string {
  const complete = message.replace(ACTION_BLOCK_PATTERN, "").trim();
  const start = complete.search(ACTION_BLOCK_START_PATTERN);
  if (start === -1) return complete;
  return complete.slice(0, start).trim();
}

export function extractAiActionsFromMessage(message: string, context: AiActionContext = {}): { content: string; actions: AiAction[] } {
  const actions: AiAction[] = [];

  for (const match of message.matchAll(ACTION_BLOCK_WITH_KIND_PATTERN)) {
    const blockName = match[1] ?? "";
    const rawJson = match[2]?.trim() ?? "";
    const blockKind = actionBlockKind(blockName);
    const payloads = parseActionPayloads(rawJson);
    for (const payload of payloads) {
      const action = normalizeActionPayload(payload, blockKind, context);
      if (action) actions.push(action);
    }
  }

  return {
    content: stripAiActionBlocks(message),
    actions,
  };
}

function actionBlockKind(blockName: string): ActionBlockKind {
  if (blockName === "loby-create-sheet") return "createSheet";
  if (blockName === "loby-insert-text") return "insertText";
  if (blockName === "loby-insert-image") return "insertImage";
  if (blockName === "loby-save-export") return "saveExport";
  return "generic";
}

function parseActionPayloads(rawJson: string): ParsedActionPayload[] {
  try {
    const parsed = JSON.parse(rawJson) as unknown;
    if (Array.isArray(parsed)) return parsed.filter(isActionPayload);
    if (isActionPayload(parsed)) return [parsed];
    return [];
  } catch {
    return [];
  }
}

function isActionPayload(value: unknown): value is ParsedActionPayload {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeActionPayload(payload: ParsedActionPayload, blockKind: ActionBlockKind, context: AiActionContext): AiAction | null {
  const type = normalizeActionType(blockKind === "generic" ? payload.action : blockKind);
  if (!type) return null;
  const actionPayload = normalizePayload(payload);
  return {
    id: `ai-action-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    status: "proposed",
    title: normalizeTitle(type, payload, actionPayload),
    summary: normalizeSummary(type, payload),
    payload: actionPayload,
    createdAt: new Date().toISOString(),
    targetProjectId: context.projectId,
    targetProjectTitle: context.projectTitle,
    targetSheetId: type === "insertText" || type === "insertImage" ? context.sheetId : undefined,
    targetSheetTitle: type === "insertText" || type === "insertImage" ? context.sheetTitle : undefined,
  };
}

function normalizeActionType(value: unknown): AiActionType | null {
  if (value === "createSheet" || value === "create-sheet" || value === "loby-create-sheet") return "createSheet";
  if (value === "insertText" || value === "insert-text" || value === "insertMarkdown" || value === "loby-insert-text") return "insertText";
  if (value === "insertImage" || value === "insert-image" || value === "loby-insert-image") return "insertImage";
  if (value === "saveExport" || value === "save-export" || value === "loby-save-export") return "saveExport";
  return null;
}

function normalizePayload(payload: ParsedActionPayload): Record<string, unknown> {
  if (payload.payload && typeof payload.payload === "object" && !Array.isArray(payload.payload)) {
    return { ...payload.payload };
  }
  const rest = { ...payload };
  delete rest.action;
  return rest;
}

function normalizeTitle(type: AiActionType, payload: ParsedActionPayload, actionPayload: Record<string, unknown>): string {
  if (typeof payload.title === "string" && payload.title.trim()) return payload.title.trim();
  const targetTitle = stringValue(actionPayload.title);
  const filename = stringValue(actionPayload.filename);
  const alt = stringValue(actionPayload.alt);
  const path = stringValue(actionPayload.path);
  const text = stringValue(actionPayload.text) || stringValue(actionPayload.markdown);
  if (type === "createSheet") return targetTitle ? `创建文稿：${targetTitle}` : "创建文稿";
  if (type === "insertText") return targetTitle ? `插入文本：${targetTitle}` : text ? "插入文本" : "插入文本";
  if (type === "insertImage") return alt || path ? `插入图片：${alt || path}` : "插入图片";
  if (type === "saveExport") return filename ? `保存导出：${filename}` : "保存导出";
  return "落笔动作";
}

function normalizeSummary(type: AiActionType, payload: ParsedActionPayload): string {
  if (typeof payload.summary === "string" && payload.summary.trim()) return payload.summary.trim();
  if (type === "createSheet") return "建议创建一张新的落笔文稿卡片。";
  if (type === "insertText") return "建议向当前文稿插入一段 Markdown 文本。";
  if (type === "insertImage") return "建议向当前文稿插入图片引用。";
  return "建议保存一个项目导出文件。";
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
