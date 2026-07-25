/**
 * [INPUT]: 依赖 shared 公共契约、写作库模块
 * [OUTPUT]: 对外提供 PrepareSheetMoveContext、SheetPropertyTypeConflict、MovedSheetRecord、SheetMoveBatchResult、applySheetMoveBatch
 * [POS]: 写作库 feature 的移动领域边界，统一跨项目默认值补齐、同名异型属性冲突识别与批量移动结果
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { MetadataValue, PropertyFieldType, WritingProject, WritingSheet } from "@/shared/types";
import { moveSheetBetweenProjects, resolveSheetMoveGroupId, type SheetMoveTarget } from "@/features/library/model/projectCreation";

export interface PrepareSheetMoveContext {
  sourceProject: WritingProject;
  sourceSheet: WritingSheet;
  targetProject: WritingProject;
  targetSheet: WritingSheet;
}

export interface SheetPropertyTypeConflict {
  key: string;
  label: string;
  sourceType: PropertyFieldType;
  targetType: PropertyFieldType;
}

export interface MovedSheetRecord {
  sourceProject: WritingProject;
  sourceSheet: WritingSheet;
  movedSheet: WritingSheet;
  propertyTypeConflicts: SheetPropertyTypeConflict[];
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

    const propertyTypeConflicts = findSheetPropertyTypeConflicts(sourceProject, sourceSheet, targetProject);
    const targetSheet = { ...sourceSheet, groupId: targetGroupId };
    const preparedSheet = prepareSheet?.({ sourceProject, sourceSheet, targetProject, targetSheet }) ?? targetSheet;
    const movedProjects = moveSheetBetweenProjects(projects, sheetId, { ...target, groupId: targetGroupId }, preparedSheet);
    if (movedProjects === projects) continue;
    projects = movedProjects;

    const movedSheet = projects.find((project) => project.id === target.projectId)?.sheets.find((sheet) => sheet.id === sheetId);
    if (movedSheet) movedSheets.push({ sourceProject, sourceSheet, movedSheet, propertyTypeConflicts });
  }

  return { projects, movedSheets, alreadyInTargetCount };
}

function findSheetPropertyTypeConflicts(
  sourceProject: WritingProject,
  sourceSheet: WritingSheet,
  targetProject: WritingProject,
): SheetPropertyTypeConflict[] {
  if (sourceProject.id === targetProject.id) return [];
  const sourceDefinitions = new Map((sourceProject.documentPropertyDefinitions ?? []).map((definition) => [definition.key, definition]));

  return (targetProject.documentPropertyDefinitions ?? []).flatMap((targetDefinition) => {
    const sourceDefinition = sourceDefinitions.get(targetDefinition.key);
    const value = sourceSheet.properties?.[targetDefinition.key];
    if (!sourceDefinition || sourceDefinition.type === targetDefinition.type || isEmptyPropertyValue(value)) return [];
    return [
      {
        key: targetDefinition.key,
        label: targetDefinition.label,
        sourceType: sourceDefinition.type,
        targetType: targetDefinition.type,
      },
    ];
  });
}

function isEmptyPropertyValue(value: MetadataValue | undefined): boolean {
  return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
}
