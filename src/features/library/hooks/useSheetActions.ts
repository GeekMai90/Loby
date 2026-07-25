/**
 * [INPUT]: 依赖 React 运行时、shared 公共契约、写作库模块、编辑器模块
 * [OUTPUT]: 对外提供 useSheetActions，创建动作返回已选中的新文稿实体供 app 协调提交后焦点
 * [POS]: 写作库 feature 的React 协调边界，封装 写作库 状态、副作用与用户动作
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useState } from "react";
import type { SheetDropTarget, WritingProject, WritingSheet } from "@/shared/types";
import { DEFAULT_USER_GROUP_ID, getVisibleProjectGroups, PROJECT_ALL_GROUP_ID } from "@/features/library/model/projectModel";
import { nowTimestamp } from "@/shared/lib/dates";
import { createSheetWithProjectDefaults } from "@/features/editor/model/documentProperties";
import { createQuickCaptureDocument } from "@/features/library/model/quickCapture";
import { createSheetId } from "@/features/library/model/documentId";

interface UseSheetActionsParams {
  activeProject: WritingProject | undefined;
  activeSheet: WritingSheet | undefined;
  activeGroupId: string;
  projectGroupFilterId: string;
  newSheetProject: WritingProject | undefined;
  newSheetGroupId: string;
  quickNotesProject: WritingProject;
  quickNotesGroupId: string;
  updateProject: (projectId: string, updater: (project: WritingProject) => WritingProject) => void;
  onSelectProject: (projectId: string) => void;
  onSelectSheet: (sheetId: string) => void;
  onSelectGroup: (groupId: string) => void;
  onSheetSearchChange: (search: string) => void;
}

export function useSheetActions({
  activeProject,
  activeSheet,
  activeGroupId,
  projectGroupFilterId,
  newSheetProject,
  newSheetGroupId,
  quickNotesProject,
  quickNotesGroupId,
  updateProject,
  onSelectProject,
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

  function appendSheet(
    project: WritingProject,
    groupId: string,
    input?: { title?: string; body?: string; targetWords?: number },
    selectAfterCreate = true,
  ) {
    const now = nowTimestamp();
    const sheet = createSheetWithProjectDefaults(project, {
      id: createSheetId(),
      title: input?.title ?? "无标题",
      groupId,
      body: input?.body ?? "",
      targetWords: input?.targetWords,
      updatedAt: now,
    });
    updateProject(project.id, (current) => ({ ...current, updatedAt: nowTimestamp(), sheets: [...current.sheets, sheet] }));
    if (selectAfterCreate) {
      onSelectProject(project.id);
      onSelectGroup(projectGroupFilterId === PROJECT_ALL_GROUP_ID && activeProject?.id === project.id ? PROJECT_ALL_GROUP_ID : groupId);
      onSelectSheet(sheet.id);
      onSheetSearchChange("");
    }
    return sheet;
  }

  function createSheet() {
    if (!newSheetProject) return;
    return appendSheet(newSheetProject, newSheetGroupId || resolveWritableGroupId(newSheetProject));
  }

  function createQuickNote(body: string) {
    const trimmed = body.trim();
    if (!trimmed) return;
    const document = createQuickCaptureDocument(trimmed);
    appendSheet(quickNotesProject, quickNotesGroupId, { ...document, targetWords: 0 }, false);
  }

  function duplicateActiveSheet() {
    if (!activeProject || !activeSheet) return;
    const sourceIndex = activeProject.sheets.findIndex((sheet) => sheet.id === activeSheet.id);
    const now = nowTimestamp();
    const sheet: WritingSheet = {
      ...activeSheet,
      id: createSheetId(),
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
    createQuickNote,
    duplicateActiveSheet,
    moveSheet,
    beginSheetReorder,
    previewSheetReorder,
    commitSheetReorder,
    clearSheetDragState,
  };
}
