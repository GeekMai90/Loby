/**
 * [INPUT]: 依赖 shared 公共契约、写作库模块
 * [OUTPUT]: 对外提供 PrepareSheetMoveContext、MovedSheetRecord、SheetMoveBatchResult、applySheetMoveBatch
 * [POS]: 写作库 feature 的领域模型边界，集中 写作库 规则、数据转换与外部契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { WritingProject, WritingSheet } from "@/shared/types";
import { moveSheetBetweenProjects, resolveSheetMoveGroupId, type SheetMoveTarget } from "@/features/library/model/projectCreation";

export interface PrepareSheetMoveContext {
  sourceProject: WritingProject;
  sourceSheet: WritingSheet;
  targetProject: WritingProject;
  targetSheet: WritingSheet;
}

export interface MovedSheetRecord {
  sourceProject: WritingProject;
  sourceSheet: WritingSheet;
  movedSheet: WritingSheet;
}

export interface SheetMoveBatchResult {
  projects: WritingProject[];
  movedSheets: MovedSheetRecord[];
  alreadyInTargetCount: number;
}

export function applySheetMoveBatch(options: {
  projects: WritingProject[];
  sheetIds: string[];
  target: SheetMoveTarget;
  prepareSheet?: (context: PrepareSheetMoveContext) => WritingSheet;
}): SheetMoveBatchResult {
  const { sheetIds, target, prepareSheet } = options;
  let projects = options.projects;
  const movedSheets: MovedSheetRecord[] = [];
  let alreadyInTargetCount = 0;

  for (const sheetId of Array.from(new Set(sheetIds))) {
    const sourceProject = projects.find((project) => project.sheets.some((sheet) => sheet.id === sheetId));
    const sourceSheet = sourceProject?.sheets.find((sheet) => sheet.id === sheetId);
    const targetProject = projects.find((project) => project.id === target.projectId);
    if (!sourceProject || !sourceSheet || !targetProject) continue;

    const targetGroupId = resolveSheetMoveGroupId(targetProject, target.groupId);
    if (sourceProject.id === targetProject.id && sourceSheet.groupId === targetGroupId) {
      alreadyInTargetCount += 1;
      continue;
    }

    const targetSheet = { ...sourceSheet, groupId: targetGroupId };
    const preparedSheet = prepareSheet?.({ sourceProject, sourceSheet, targetProject, targetSheet }) ?? targetSheet;
    const movedProjects = moveSheetBetweenProjects(projects, sheetId, { ...target, groupId: targetGroupId }, preparedSheet);
    if (movedProjects === projects) continue;
    projects = movedProjects;

    const movedSheet = projects.find((project) => project.id === target.projectId)?.sheets.find((sheet) => sheet.id === sheetId);
    if (movedSheet) movedSheets.push({ sourceProject, sourceSheet, movedSheet });
  }

  return { projects, movedSheets, alreadyInTargetCount };
}
