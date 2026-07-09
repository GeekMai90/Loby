import type { AiChangeBlock, AiChangeSet, WritingSheet } from "../types";
import { parseImageReferences } from "./imageAssets";

interface ParsedChangePayload {
  summary?: string;
  proposedBody?: string;
  changes?: Array<{
    fromText?: string;
    toText?: string;
    reason?: string;
    anchor?: {
      before?: string;
      after?: string;
      startLine?: number;
      endLine?: number;
    };
  }>;
}

const CHANGE_BLOCK_PATTERN = /```(?:nibva-change|nibva_changes|json\s+nibva-change)\s*([\s\S]*?)```/i;
const CHANGE_BLOCK_START_PATTERN = /```(?:nibva-change|nibva_changes|json\s+nibva-change)\b/i;

export const AI_CHANGE_SET_MESSAGES = {
  applySheetMissing: "无法找到这个 AI 修改对应的文稿，已取消自动应用。",
  applyBodyChanged: "这篇文稿在 AI 生成修改期间已经被继续编辑，已取消自动应用，避免覆盖你的新内容。",
  applyImageReferenceInserted: "AI 这次用正文修改直接新增了图片引用，已取消自动应用。图片应显示为插入图片动作卡片，先预览确认后再插入。",
  rollbackSheetMissing: "无法找到这个 AI 修改对应的文稿，撤销失败。",
  rollbackBodyChanged: "这篇文稿在 AI 修改之后已经被继续编辑，不能从修改卡片直接撤销。",
} as const;

export type AiChangeSetGuardResult = { ok: true } | { ok: false; message: string };

export function stripAiChangeBlock(message: string): string {
  const complete = message.replace(CHANGE_BLOCK_PATTERN, "").trim();
  const start = complete.search(CHANGE_BLOCK_START_PATTERN);
  if (start === -1) return complete;
  return complete.slice(0, start).trim();
}

export function extractAiChangeSetFromMessage(
  message: string,
  sheetId: string,
  baseBody: string,
): { content: string; changeSet: AiChangeSet | null } {
  const match = message.match(CHANGE_BLOCK_PATTERN);
  if (!match) return { content: message, changeSet: null };

  const rawJson = match[1]?.trim() ?? "";
  const content = stripAiChangeBlock(message);
  const payload = parseChangePayload(rawJson);
  if (!payload?.proposedBody || payload.proposedBody.trim() === baseBody.trim()) {
    return { content, changeSet: null };
  }

  const changes = normalizeChangeBlocks(payload, baseBody, payload.proposedBody);
  if (changes.length === 0) return { content, changeSet: null };

  return {
    content,
    changeSet: {
      id: `ai-change-${Date.now()}`,
      sheetId,
      status: "pending",
      createdAt: new Date().toISOString(),
      summary: payload.summary?.trim() || "AI 建议修改当前文稿",
      baseBody,
      proposedBody: payload.proposedBody,
      changes,
    },
  };
}

export function applyAcceptedChangeToBody(body: string, change: AiChangeBlock): string {
  if (!change.fromText) return insertChangeByAnchor(body, change);
  const index = body.indexOf(change.fromText);
  if (index === -1) return body;
  return `${body.slice(0, index)}${change.toText}${body.slice(index + change.fromText.length)}`;
}

export function applyAcceptedChangesToBody(baseBody: string, changes: AiChangeBlock[]): string {
  return changes.reduce((body, change) => (change.status === "accepted" ? applyAcceptedChangeToBody(body, change) : body), baseBody);
}

export function acceptAiChangeSet(changeSet: AiChangeSet): AiChangeSet {
  return {
    ...changeSet,
    status: "accepted",
    error: undefined,
    changes: changeSet.changes.map((change) => ({ ...change, status: "accepted" })),
  };
}

export function rejectAiChangeSet(changeSet: AiChangeSet): AiChangeSet {
  return {
    ...changeSet,
    status: "rejected",
    error: undefined,
    changes: changeSet.changes.map((change) => ({ ...change, status: "rejected" })),
  };
}

export function filterVisibleAiChangeSetIds(visibleIds: string[], changeSets: AiChangeSet[]): string[] {
  return visibleIds.filter((changeSetId) => changeSets.some((changeSet) => changeSet.id === changeSetId));
}

export function filterReviewPanelChangeSets(changeSets: AiChangeSet[], activeSheetId: string): AiChangeSet[] {
  return changeSets.filter(
    (changeSet) => changeSet.status !== "rejected" && (changeSet.sheetId === activeSheetId || Boolean(changeSet.error)),
  );
}

export function validateAiChangeSetApply(sheet: WritingSheet | undefined, changeSet: AiChangeSet): AiChangeSetGuardResult {
  if (!sheet || sheet.id !== changeSet.sheetId) {
    return { ok: false, message: AI_CHANGE_SET_MESSAGES.applySheetMissing };
  }
  if (sheet.body !== changeSet.baseBody) {
    return { ok: false, message: AI_CHANGE_SET_MESSAGES.applyBodyChanged };
  }
  return { ok: true };
}

export function changeSetIntroducesImageReference(changeSet: AiChangeSet): boolean {
  const basePaths = new Set(parseImageReferences(changeSet.baseBody).map((reference) => reference.path));
  return parseImageReferences(changeSet.proposedBody).some((reference) => !basePaths.has(reference.path));
}

export function validateAiChangeSetRollback(sheet: WritingSheet | undefined, changeSet: AiChangeSet): AiChangeSetGuardResult {
  if (!sheet || sheet.id !== changeSet.sheetId) {
    return { ok: false, message: AI_CHANGE_SET_MESSAGES.rollbackSheetMissing };
  }
  if (sheet.body !== changeSet.proposedBody) {
    return { ok: false, message: AI_CHANGE_SET_MESSAGES.rollbackBodyChanged };
  }
  return { ok: true };
}

export function shouldOpenAiChangeSetTarget(changeSet: AiChangeSet, activeSheetId: string): boolean {
  return Boolean(changeSet.sheetId && changeSet.sheetId !== activeSheetId);
}

export function aiChangeSetPrimaryAction(changeSet: AiChangeSet): "dismiss" | "rollback" {
  return changeSet.error ? "dismiss" : "rollback";
}

export function resolveChangeSetStatus(changes: AiChangeBlock[]): AiChangeSet["status"] {
  if (changes.every((change) => change.status === "accepted")) return "accepted";
  if (changes.every((change) => change.status === "rejected")) return "rejected";
  if (changes.some((change) => change.status === "accepted" || change.status === "rejected")) return "partiallyAccepted";
  return "pending";
}

export function findChangePosition(body: string, change: AiChangeBlock): { from: number; to: number } | null {
  const text = change.status === "accepted" ? change.toText : change.fromText;
  if (!text) return findAnchorPosition(body, change);
  const index = body.indexOf(text);
  if (index === -1) return null;
  return { from: index, to: index + text.length };
}

function insertChangeByAnchor(body: string, change: AiChangeBlock): string {
  if (!change.toText) return body;
  if (change.anchor?.before) {
    const index = body.indexOf(change.anchor.before);
    if (index !== -1) {
      const insertionPoint = index + change.anchor.before.length;
      const separator = body[insertionPoint] === "\n" || change.toText.startsWith("\n") ? "" : "\n";
      return `${body.slice(0, insertionPoint)}${separator}${change.toText}${body.slice(insertionPoint)}`;
    }
  }
  if (change.anchor?.after) {
    const index = body.indexOf(change.anchor.after);
    if (index !== -1) {
      const separator = body[index - 1] === "\n" || change.toText.endsWith("\n") ? "" : "\n";
      return `${body.slice(0, index)}${change.toText}${separator}${body.slice(index)}`;
    }
  }
  return body;
}

function findAnchorPosition(body: string, change: AiChangeBlock): { from: number; to: number } | null {
  if (change.anchor?.before) {
    const index = body.indexOf(change.anchor.before);
    if (index !== -1) return { from: index, to: index + change.anchor.before.length };
  }
  if (change.anchor?.after) {
    const index = body.indexOf(change.anchor.after);
    if (index !== -1) return { from: index, to: index + change.anchor.after.length };
  }
  return null;
}

function parseChangePayload(rawJson: string): ParsedChangePayload | null {
  try {
    return JSON.parse(rawJson) as ParsedChangePayload;
  } catch {
    return null;
  }
}

function normalizeChangeBlocks(payload: ParsedChangePayload, baseBody: string, proposedBody: string): AiChangeBlock[] {
  const payloadChanges = (payload.changes ?? [])
    .filter((change) => typeof change.fromText === "string" && typeof change.toText === "string" && change.fromText !== change.toText)
    .map((change, index): AiChangeBlock => ({
      id: `change-${Date.now()}-${index}`,
      status: "pending",
      fromText: change.fromText ?? "",
      toText: change.toText ?? "",
      reason: change.reason?.trim() || "",
      anchor: change.anchor ?? {},
    }));

  if (payloadChanges.length > 0) return payloadChanges;
  return buildLineChangeBlocks(baseBody, proposedBody);
}

function buildLineChangeBlocks(baseBody: string, proposedBody: string): AiChangeBlock[] {
  const baseLines = baseBody.split("\n");
  const proposedLines = proposedBody.split("\n");
  const table = Array.from({ length: baseLines.length + 1 }, () => Array(proposedLines.length + 1).fill(0));

  for (let i = baseLines.length - 1; i >= 0; i -= 1) {
    for (let j = proposedLines.length - 1; j >= 0; j -= 1) {
      table[i][j] = baseLines[i] === proposedLines[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  const changes: AiChangeBlock[] = [];
  let i = 0;
  let j = 0;
  let removed: string[] = [];
  let added: string[] = [];
  let startLine = 1;

  function flush() {
    if (removed.length === 0 && added.length === 0) return;
    changes.push({
      id: `change-${Date.now()}-${changes.length}`,
      status: "pending",
      fromText: removed.join("\n"),
      toText: added.join("\n"),
      reason: "",
      anchor: {
        before: baseLines[Math.max(0, startLine - 2)] ?? "",
        after: baseLines[i] ?? "",
        startLine,
        endLine: Math.max(startLine, i),
      },
    });
    removed = [];
    added = [];
  }

  while (i < baseLines.length && j < proposedLines.length) {
    if (baseLines[i] === proposedLines[j]) {
      flush();
      i += 1;
      j += 1;
      startLine = i + 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      if (removed.length === 0 && added.length === 0) startLine = i + 1;
      removed.push(baseLines[i]);
      i += 1;
    } else {
      if (removed.length === 0 && added.length === 0) startLine = i + 1;
      added.push(proposedLines[j]);
      j += 1;
    }
  }

  while (i < baseLines.length) {
    if (removed.length === 0 && added.length === 0) startLine = i + 1;
    removed.push(baseLines[i]);
    i += 1;
  }
  while (j < proposedLines.length) {
    if (removed.length === 0 && added.length === 0) startLine = i + 1;
    added.push(proposedLines[j]);
    j += 1;
  }
  flush();

  return changes.filter((change) => change.fromText !== change.toText);
}
