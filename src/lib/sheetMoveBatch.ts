import type { WritingProject, WritingSheet } from "../types";
import { moveSheetBetweenProjects, resolveSheetMoveGroupId, type SheetMoveTarget } from "./projectCreation";

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
