/**
 * [INPUT]: 依赖 shared/types 的 AiAction 目标身份与 WritingProject 项目树
 * [OUTPUT]: 对外提供 AiActionNavigationTarget、resolveAiActionNavigationTarget
 * [POS]: AI 动作到当前写作库位置的只读解析器，为卡片导航提供可验证目标
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { AiAction, WritingProject } from "@/shared/types";

export type AiActionNavigationTarget =
  | {
      ok: true;
      projectId: string;
      projectTitle: string;
      sheetId?: string;
      sheetTitle?: string;
      groupId?: string;
    }
  | { ok: false; message: string };

export function resolveAiActionNavigationTarget(action: AiAction, projects: WritingProject[]): AiActionNavigationTarget {
  if (action.targetSheetId) {
    const ownerProject = projects.find((project) => project.sheets.some((sheet) => sheet.id === action.targetSheetId));
    const targetSheet = ownerProject?.sheets.find((sheet) => sheet.id === action.targetSheetId);
    if (!ownerProject || !targetSheet) {
      return {
        ok: false,
        message: `无法找到这个 AI 动作对应的文稿「${action.targetSheetTitle || action.targetSheetId}」。`,
      };
    }
    return {
      ok: true,
      projectId: ownerProject.id,
      projectTitle: ownerProject.title,
      sheetId: targetSheet.id,
      sheetTitle: targetSheet.title,
      groupId: targetSheet.groupId,
    };
  }

  if (action.targetProjectId) {
    const targetProject = projects.find((project) => project.id === action.targetProjectId);
    if (!targetProject) {
      return {
        ok: false,
        message: `无法找到这个 AI 动作对应的项目「${action.targetProjectTitle || action.targetProjectId}」。`,
      };
    }
    return {
      ok: true,
      projectId: targetProject.id,
      projectTitle: targetProject.title,
      sheetId: targetProject.sheets[0]?.id,
      sheetTitle: targetProject.sheets[0]?.title,
      groupId: targetProject.sheets[0]?.groupId ?? targetProject.groups?.[0]?.id,
    };
  }

  return { ok: false, message: "这个 AI 动作没有记录目标位置。" };
}
