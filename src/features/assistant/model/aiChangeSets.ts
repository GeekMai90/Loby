/**
 * [INPUT]: 依赖 shared Myers 文本差异、公共契约与写作库模块
 * [OUTPUT]: 对外提供结构化 createAiChangeSetFromPayload、旧消息提取、差异应用/审阅与安全护栏
 * [POS]: AI 助手正文修改领域边界；runtime payload 是主入口，loby-change 代码块只服务历史会话兼容
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { AiChangeBlock, AiChangeSet, WritingSheet } from "@/shared/types";
import { parseImageReferences } from "@/features/library/model/imageAssets";
import { buildTextDiffParts } from "@/shared/lib/diff";

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

const CHANGE_BLOCK_PATTERN =
  /^```(?:loby-change|loby_changes|json[^\S\r\n]+loby-change)[^\S\r\n]*\r?\n([\s\S]*?)^```[^\S\r\n]*(?=\r?\n|$)/im;
const CHANGE_BLOCK_START_PATTERN = /^```(?:loby-change|loby_changes|json[^\S\r\n]+loby-change)\b/im;

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
  return { content, changeSet: createAiChangeSetFromPayload(payload, sheetId, baseBody) };
}

export function createAiChangeSetFromPayload(payload: unknown, sheetId: string, baseBody: string): AiChangeSet | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const candidate = payload as ParsedChangePayload;
  if (!candidate.proposedBody || candidate.proposedBody.trim() === baseBody.trim()) return null;

  const changes = normalizeChangeBlocks(candidate, baseBody, candidate.proposedBody);
  if (changes.length === 0) return null;

  const changeSet: AiChangeSet = {
    id: `ai-change-${Date.now()}`,
    sheetId,
    status: "pending",
    createdAt: new Date().toISOString(),
    summary: candidate.summary?.trim() || "AI 建议修改当前文稿",
    baseBody,
    proposedBody: candidate.proposedBody,
    changes,
  };

  return { ...changeSet, changes: positionAiReviewChanges(changeSet) };
}

export function applyAcceptedChangeToBody(body: string, change: AiChangeBlock): string {
  const baseFrom = change.anchor.baseFrom;
  const baseTo = change.anchor.baseTo;
  if (
    typeof baseFrom === "number" &&
    typeof baseTo === "number" &&
    baseFrom >= 0 &&
    baseTo >= baseFrom &&
    body.slice(baseFrom, baseTo) === change.fromText
  ) {
    return `${body.slice(0, baseFrom)}${change.toText}${body.slice(baseTo)}`;
  }
  if (!change.fromText) return insertChangeByAnchor(body, change);
  const index = body.indexOf(change.fromText);
  if (index === -1) return body;
  return `${body.slice(0, index)}${change.toText}${body.slice(index + change.fromText.length)}`;
}

export function applyAcceptedChangesToBody(baseBody: string, changes: AiChangeBlock[]): string {
  const acceptedChanges = changes.filter((change) => change.status === "accepted");
  return (
    applyBaseAnchoredChanges(baseBody, acceptedChanges) ??
    acceptedChanges.reduce((body, change) => applyAcceptedChangeToBody(body, change), baseBody)
  );
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

export function resolveAiReviewPreviewBody(changeSets: AiChangeSet[], hiddenChangeSetIds: readonly string[]): string | null {
  const appliedChangeSets = changeSets.filter(
    (changeSet) => !changeSet.error && (changeSet.status === "accepted" || changeSet.status === "partiallyAccepted"),
  );
  if (appliedChangeSets.length === 0 || appliedChangeSets.some((changeSet) => !hiddenChangeSetIds.includes(changeSet.id))) return null;
  return appliedChangeSets[0]?.baseBody ?? null;
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

export function positionAiReviewChanges(changeSet: AiChangeSet): AiChangeBlock[] {
  const reviewChanges = changesReconstructProposedBody(changeSet.baseBody, changeSet.proposedBody, changeSet.changes)
    ? changeSet.changes
    : buildDocumentChangeBlocks(changeSet.baseBody, changeSet.proposedBody).map((change) => ({
        ...change,
        status: changeSet.status === "accepted" ? ("accepted" as const) : ("pending" as const),
      }));
  let baseSearchFrom = 0;
  return reviewChanges.map((change) => {
    if (hasResolvedReviewAnchor(changeSet.proposedBody, change)) return change;
    if (change.toText || !change.fromText) return change;

    const baseFrom = findBaseChangePosition(changeSet.baseBody, change, baseSearchFrom);
    if (baseFrom < 0) return change;
    baseSearchFrom = baseFrom + change.fromText.length;

    const proposedFrom = findDeletionReviewPosition(
      changeSet.baseBody,
      changeSet.proposedBody,
      baseFrom,
      baseFrom + change.fromText.length,
    );
    if (proposedFrom < 0) return change;
    const deletedLineRange = wholeLineRange(changeSet.baseBody, baseFrom, baseFrom + change.fromText.length);

    return {
      ...change,
      anchor: {
        ...change.anchor,
        from: proposedFrom,
        to: proposedFrom,
        ...(deletedLineRange ?? {}),
      },
    };
  });
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

function findBaseChangePosition(body: string, change: AiChangeBlock, searchFrom: number) {
  if (typeof change.anchor.startLine === "number") {
    const lineFrom = lineStartOffset(body, change.anchor.startLine);
    if (lineFrom >= 0 && body.slice(lineFrom, lineFrom + change.fromText.length) === change.fromText) return lineFrom;
  }
  const orderedIndex = body.indexOf(change.fromText, searchFrom);
  if (orderedIndex >= 0) return orderedIndex;
  return body.indexOf(change.fromText);
}

function findDeletionReviewPosition(baseBody: string, proposedBody: string, baseFrom: number, baseTo: number) {
  const beforeEnd = findStableContextEnd(proposedBody, baseBody.slice(0, baseFrom));
  const afterStart = findStableContextStart(proposedBody, baseBody.slice(baseTo), Math.max(0, beforeEnd));

  if (afterStart >= 0) return afterStart;
  if (beforeEnd >= 0) return beforeEnd;
  return Math.min(baseFrom, proposedBody.length);
}

function findStableContextEnd(body: string, text: string) {
  const trimmed = text.trimEnd();
  const maxLength = Math.min(80, trimmed.length);
  const minLength = Math.min(6, maxLength);
  for (let length = maxLength; length >= minLength; length -= 1) {
    const marker = trimmed.slice(trimmed.length - length);
    const markerEnd = findUniqueMarkerEnd(body, marker);
    if (markerEnd >= 0) return markerEnd;
  }
  return -1;
}

function findStableContextStart(body: string, text: string, searchFrom: number) {
  const trimmed = text.trimStart();
  const maxLength = Math.min(80, trimmed.length);
  const minLength = Math.min(6, maxLength);
  for (let length = maxLength; length >= minLength; length -= 1) {
    const markerStart = findMarkerStartAfter(body, trimmed.slice(0, length), searchFrom);
    if (markerStart >= 0) return markerStart;
  }
  return -1;
}

function findUniqueMarkerEnd(body: string, marker: string) {
  const index = body.indexOf(marker);
  if (index < 0 || body.indexOf(marker, index + 1) >= 0) return -1;
  return index + marker.length;
}

function findMarkerStartAfter(body: string, marker: string, searchFrom: number) {
  const index = body.indexOf(marker, searchFrom);
  if (index >= 0 && (searchFrom > 0 || body.indexOf(marker, index + 1) < 0)) return index;
  const fallback = body.indexOf(marker);
  return fallback >= 0 && body.indexOf(marker, fallback + 1) < 0 ? fallback : -1;
}

function lineStartOffset(body: string, line: number) {
  if (line <= 1) return 0;
  let offset = 0;
  for (let currentLine = 1; currentLine < line; currentLine += 1) {
    const newline = body.indexOf("\n", offset);
    if (newline < 0) return -1;
    offset = newline + 1;
  }
  return offset;
}

function wholeLineRange(body: string, from: number, to: number): { startLine: number; endLine: number } | null {
  const startsAtLineBoundary = from === 0 || body[from - 1] === "\n";
  const endsAtLineBoundary = to === body.length || body[to] === "\n";
  if (!startsAtLineBoundary || !endsAtLineBoundary) return null;
  const startLine = body.slice(0, from).split("\n").length;
  return {
    startLine,
    endLine: startLine + changeLineCount(body.slice(from, to)) - 1,
  };
}

function changeLineCount(text: string) {
  return Math.max(1, text.split("\n").length);
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

  if (payloadChanges.length > 0 && changesReconstructProposedBody(baseBody, proposedBody, payloadChanges)) return payloadChanges;
  return buildDocumentChangeBlocks(baseBody, proposedBody);
}

function changesReconstructProposedBody(baseBody: string, proposedBody: string, changes: AiChangeBlock[]) {
  const reconstructedBody = applyAcceptedChangesToBody(
    baseBody,
    changes.map((change) => ({ ...change, status: "accepted" })),
  );
  return reconstructedBody === proposedBody;
}

function buildDocumentChangeBlocks(baseBody: string, proposedBody: string): AiChangeBlock[] {
  const parts = buildTextDiffParts(baseBody, proposedBody);
  const changes: AiChangeBlock[] = [];
  let baseOffset = 0;
  let proposedOffset = 0;
  let pending: { baseFrom: number; proposedFrom: number; removed: string; added: string } | null = null;

  function flush() {
    if (!pending) return;
    const baseTo = baseOffset;
    const proposedTo = proposedOffset;
    const before = proposedBody.slice(Math.max(0, pending.proposedFrom - 48), pending.proposedFrom);
    const after = proposedBody.slice(proposedTo, Math.min(proposedBody.length, proposedTo + 48));
    const deletedLineRange = pending.added ? null : wholeLineRange(baseBody, pending.baseFrom, baseTo);
    changes.push({
      id: `change-${Date.now()}-${changes.length}`,
      status: "pending",
      fromText: pending.removed,
      toText: pending.added,
      reason: "",
      anchor: {
        ...(before ? { before } : {}),
        ...(after ? { after } : {}),
        startLine: lineNumberAtOffset(baseBody, pending.baseFrom),
        endLine: lineNumberAtOffset(baseBody, Math.max(pending.baseFrom, baseTo - 1)),
        wholeLine: Boolean(deletedLineRange),
        baseFrom: pending.baseFrom,
        baseTo,
        from: pending.proposedFrom,
        to: proposedTo,
      },
    });
    pending = null;
  }

  for (const part of parts) {
    if (part.kind === "same") {
      flush();
      baseOffset += part.text.length;
      proposedOffset += part.text.length;
      continue;
    }

    pending ??= { baseFrom: baseOffset, proposedFrom: proposedOffset, removed: "", added: "" };
    if (part.kind === "removed") {
      pending.removed += part.text;
      baseOffset += part.text.length;
    } else {
      pending.added += part.text;
      proposedOffset += part.text.length;
    }
  }
  flush();

  return changes.filter((change) => change.fromText !== change.toText);
}

function applyBaseAnchoredChanges(baseBody: string, changes: AiChangeBlock[]): string | null {
  const ranges = changes
    .map((change) => ({ change, from: change.anchor.baseFrom, to: change.anchor.baseTo }))
    .sort((left, right) => (left.from ?? -1) - (right.from ?? -1));
  if (
    ranges.some(
      ({ change, from, to }, index) =>
        typeof from !== "number" ||
        typeof to !== "number" ||
        from < 0 ||
        to < from ||
        baseBody.slice(from, to) !== change.fromText ||
        (index > 0 && from < (ranges[index - 1].to ?? -1)),
    )
  ) {
    return null;
  }

  return ranges
    .slice()
    .reverse()
    .reduce((body, { change, from, to }) => `${body.slice(0, from)}${change.toText}${body.slice(to)}`, baseBody);
}

function hasResolvedReviewAnchor(proposedBody: string, change: AiChangeBlock) {
  const { from, to } = change.anchor;
  if (typeof from !== "number" || typeof to !== "number" || from < 0 || to < from || to > proposedBody.length) return false;
  return change.toText ? proposedBody.slice(from, to) === change.toText : from === to;
}

function lineNumberAtOffset(body: string, offset: number) {
  return body.slice(0, Math.max(0, Math.min(offset, body.length))).split("\n").length;
}
