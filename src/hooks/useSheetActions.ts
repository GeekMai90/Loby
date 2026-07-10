import { useState } from "react";
import type { SheetDropTarget, WritingProject, WritingSheet } from "../types";
import {
  DEFAULT_USER_GROUP_ID,
  createDefaultProjectGroups,
  ensureGroupExists,
  ensureMaterialGroup,
  getVisibleProjectGroups,
} from "../lib/projectModel";
import { nowTimestamp } from "../lib/dates";
import { buildImportedMarkdownSheets } from "../lib/importMarkdown";
import { importMarkdownFiles } from "../lib/persistence";
import { createSheetWithProjectDefaults } from "../lib/documentProperties";

interface UseSheetActionsParams {
  activeProject: WritingProject | undefined;
  activeSheet: WritingSheet | undefined;
  activeSheetId: string;
  activeGroupId: string;
  updateProject: (projectId: string, updater: (project: WritingProject) => WritingProject) => void;
  onSelectSheet: (sheetId: string) => void;
  onSelectGroup: (groupId: string) => void;
  onSheetSearchChange: (search: string) => void;
}

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useSheetActions({
  activeProject,
  activeSheet,
  activeSheetId,
  activeGroupId,
  updateProject,
  onSelectSheet,
  onSelectGroup,
  onSheetSearchChange,
}: UseSheetActionsParams) {
  const [draggingSheetId, setDraggingSheetId] = useState("");
  const [sheetDropTarget, setSheetDropTarget] = useState<SheetDropTarget | null>(null);

  function resolveWritableGroupId(project: WritingProject): string {
    if (activeGroupId) return activeGroupId;
    return getVisibleProjectGroups(project)[0]?.id ?? DEFAULT_USER_GROUP_ID;
  }

  function createSheet() {
    if (!activeProject) return;
    const groupId = resolveWritableGroupId(activeProject);
    const now = nowTimestamp();
    const sheet = createSheetWithProjectDefaults(activeProject, {
      id: createId("sheet"),
      title: "无标题",
      groupId,
      body: "",
      updatedAt: now,
    });
    updateProject(activeProject.id, (project) => ({ ...project, updatedAt: nowTimestamp(), sheets: [...project.sheets, sheet] }));
    onSelectGroup(groupId);
    onSelectSheet(sheet.id);
    onSheetSearchChange("");
  }

  function createMaterialSheet() {
    if (!activeProject) return;
    const materialGroupId = ensureMaterialGroup(activeProject).id;
    const now = nowTimestamp();
    const sheet = createSheetWithProjectDefaults(activeProject, {
      id: createId("sheet"),
      title: "新的素材卡片",
      groupId: materialGroupId,
      type: "素材",
      targetWords: 500,
      summary: "记录事实、摘录、案例、图片方向或参考资料。",
      body: "# 新的素材卡片\n\n- 来源：\n- 关键事实：\n- 可用观点：\n",
      updatedAt: now,
    });
    updateProject(activeProject.id, (project) => ({
      ...project,
      groups: ensureGroupExists(project.groups ?? createDefaultProjectGroups(), materialGroupId, "素材"),
      updatedAt: nowTimestamp(),
      sheets: [...project.sheets, sheet],
    }));
    onSelectGroup(materialGroupId);
    onSelectSheet(sheet.id);
  }

  async function importMarkdownSheets() {
    if (!activeProject) return;
    try {
      const files = await importMarkdownFiles();
      if (files.length === 0) return;
      const groupId = resolveWritableGroupId(activeProject);
      const importedSheets = buildImportedMarkdownSheets(files, groupId, activeProject);
      updateProject(activeProject.id, (project) => ({
        ...project,
        updatedAt: nowTimestamp(),
        sheets: [...project.sheets, ...importedSheets],
      }));
      onSelectGroup(groupId);
      onSelectSheet(importedSheets[0]?.id ?? activeSheetId);
      onSheetSearchChange("");
    } catch (error) {
      window.alert(`导入 Markdown 失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  function duplicateActiveSheet() {
    if (!activeProject || !activeSheet) return;
    const sourceIndex = activeProject.sheets.findIndex((sheet) => sheet.id === activeSheet.id);
    const now = nowTimestamp();
    const sheet: WritingSheet = {
      ...activeSheet,
      id: createId("sheet"),
      title: `${activeSheet.title} 副本`,
      createdAt: now,
      updatedAt: now,
      versions: [],
    };
    updateProject(activeProject.id, (project) => {
      const sheets = [...project.sheets];
      sheets.splice(sourceIndex >= 0 ? sourceIndex + 1 : sheets.length, 0, sheet);
      return { ...project, updatedAt: nowTimestamp(), sheets };
    });
    onSelectSheet(sheet.id);
  }

  function moveSheet(sheetId: string, direction: -1 | 1) {
    if (!activeProject) return;
    updateProject(activeProject.id, (project) => {
      const index = project.sheets.findIndex((sheet) => sheet.id === sheetId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= project.sheets.length) return project;
      const sheets = [...project.sheets];
      const [sheet] = sheets.splice(index, 1);
      sheets.splice(nextIndex, 0, sheet);
      return { ...project, updatedAt: nowTimestamp(), sheets };
    });
  }

  function reorderSheetByDrop(sourceSheetId: string, targetSheetId: string, position: SheetDropTarget["position"]) {
    if (!activeProject || sourceSheetId === targetSheetId) return;
    updateProject(activeProject.id, (project) => {
      const source = project.sheets.find((sheet) => sheet.id === sourceSheetId);
      if (!source) return project;
      const sheetsWithoutSource = project.sheets.filter((sheet) => sheet.id !== sourceSheetId);
      const targetIndex = sheetsWithoutSource.findIndex((sheet) => sheet.id === targetSheetId);
      if (targetIndex < 0) return project;
      const insertIndex = position === "before" ? targetIndex : targetIndex + 1;
      const sheets = [...sheetsWithoutSource];
      sheets.splice(insertIndex, 0, source);
      return { ...project, updatedAt: nowTimestamp(), sheets };
    });
  }

  function beginSheetReorder(sheetId: string) {
    setDraggingSheetId(sheetId);
    setSheetDropTarget(null);
  }

  function previewSheetReorder(target: SheetDropTarget | null) {
    setSheetDropTarget(target);
  }

  function commitSheetReorder(sourceSheetId: string, targetSheetId: string, position: SheetDropTarget["position"]) {
    reorderSheetByDrop(sourceSheetId, targetSheetId, position);
    setDraggingSheetId("");
    setSheetDropTarget(null);
  }

  function clearSheetDragState() {
    setDraggingSheetId("");
    setSheetDropTarget(null);
  }

  return {
    draggingSheetId,
    sheetDropTarget,
    createSheet,
    createMaterialSheet,
    importMarkdownSheets,
    duplicateActiveSheet,
    moveSheet,
    beginSheetReorder,
    previewSheetReorder,
    commitSheetReorder,
    clearSheetDragState,
  };
}
