/**
 * [INPUT]: 依赖 shared 公共契约
 * [OUTPUT]: 对外提供 CreatedSheetRevertTarget、SheetVersionRestoreTarget、AiActionEffectGuardResult、AI_ACTION_EFFECT_MESSAGES、AiActionTargetContext、AiActionTargetGuardResult、createdSheetMatchesEffect、validateCreatedSheetRevertEffect 等公开能力
 * [POS]: AI 助手 feature 的领域模型边界，集中 AI 助手 规则、数据转换与外部契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { AiAction, AiActionEffect, SheetVersion, WritingProject, WritingSheet } from "@/shared/types";

type CreatedSheetEffect = Extract<AiActionEffect, { type: "createdSheet" }>;
type SheetVersionRestoreEffect = Extract<AiActionEffect, { type: "sheetVersionRestore" }>;

export interface CreatedSheetRevertTarget {
  ownerProject: WritingProject;
  targetSheet: WritingSheet;
}

export interface SheetVersionRestoreTarget {
  ownerProject: WritingProject;
  targetSheet: WritingSheet;
  restoreVersion: SheetVersion;
}

export type AiActionEffectGuardResult<T> = { ok: true; target: T } | { ok: false; message: string };

export const AI_ACTION_EFFECT_MESSAGES = {
  createdSheetMissing: "无法找到这个 AI 动作创建的文稿，撤销失败。",
  createdSheetChanged: "这张 AI 创建的文稿已经被修改，不能从动作卡片直接删除。",
  restoreVersionMissing: "无法找到这个 AI 动作对应的插入前版本，撤销失败。",
  restoreBodyChanged: "这篇文稿在 AI 动作之后已经被修改，不能从动作卡片直接撤销。",
} as const;

export interface AiActionTargetContext {
  activeProject?: WritingProject;
  activeSheet?: WritingSheet;
}

export type AiActionTargetGuardResult = { ok: true } | { ok: false; message: string };

export function createdSheetMatchesEffect(sheet: WritingSheet, effect: CreatedSheetEffect): boolean {
  return (
    sheet.title === effect.sheetTitle &&
    sheet.description === effect.description &&
    sheet.body === effect.body &&
    sheet.targetWords === effect.targetWords
  );
}

export function validateCreatedSheetRevertEffect(
  projects: WritingProject[],
  effect: CreatedSheetEffect,
): AiActionEffectGuardResult<CreatedSheetRevertTarget> {
  const ownerProject = projects.find((project) => project.id === effect.projectId);
  const targetSheet = ownerProject?.sheets.find((sheet) => sheet.id === effect.sheetId);
  if (!ownerProject || !targetSheet) {
    return { ok: false, message: AI_ACTION_EFFECT_MESSAGES.createdSheetMissing };
  }
  if (!createdSheetMatchesEffect(targetSheet, effect)) {
    return { ok: false, message: AI_ACTION_EFFECT_MESSAGES.createdSheetChanged };
  }
  return { ok: true, target: { ownerProject, targetSheet } };
}

export function validateSheetVersionRestoreEffect(
  projects: WritingProject[],
  effect: SheetVersionRestoreEffect,
): AiActionEffectGuardResult<SheetVersionRestoreTarget> {
  const ownerProject = projects.find((project) => project.sheets.some((sheet) => sheet.id === effect.sheetId));
  const targetSheet = ownerProject?.sheets.find((sheet) => sheet.id === effect.sheetId);
  const restoreVersion = targetSheet?.versions?.find((version) => version.id === effect.versionId);
  if (!ownerProject || !targetSheet || !restoreVersion) {
    return { ok: false, message: AI_ACTION_EFFECT_MESSAGES.restoreVersionMissing };
  }
  if (effect.appliedBody !== undefined && targetSheet.body !== effect.appliedBody) {
    return { ok: false, message: AI_ACTION_EFFECT_MESSAGES.restoreBodyChanged };
  }
  return { ok: true, target: { ownerProject, targetSheet, restoreVersion } };
}

export function validateAiActionTarget(action: AiAction, context: AiActionTargetContext): AiActionTargetGuardResult {
  if (action.targetProjectId && context.activeProject?.id !== action.targetProjectId) {
    return {
      ok: false,
      message: `这个动作是为项目「${action.targetProjectTitle || action.targetProjectId}」生成的，请先切回该项目后执行。`,
    };
  }
  if (
    (action.type === "insertText" || action.type === "insertImage") &&
    action.targetSheetId &&
    context.activeSheet?.id !== action.targetSheetId
  ) {
    return {
      ok: false,
      message: `这个动作是为文稿「${action.targetSheetTitle || action.targetSheetId}」生成的，请先切回该文稿后执行。`,
    };
  }
  return { ok: true };
}
