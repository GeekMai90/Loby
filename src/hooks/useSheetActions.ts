import type { DragEvent } from "react";
import { useState } from "react";
import type { AiSuggestion, ProjectStatus, SheetDropTarget, WritingProject, WritingSheet } from "../types";
import { DEFAULT_CONTENT_GROUP_ID, ensureGroupExists, ensureMaterialGroup, createDefaultProjectGroups } from "../lib/projectModel";
import { today } from "../lib/dates";
import { buildImportedMarkdownSheets } from "../lib/importMarkdown";
import { importMarkdownFiles } from "../lib/persistence";
import { countWords } from "../lib/text";

interface UseSheetActionsParams {
  activeProject: WritingProject | undefined;
  activeSheet: WritingSheet | undefined;
  activeSheetId: string;
  activeGroupId: string;
  updateProject: (projectId: string, updater: (project: WritingProject) => WritingProject) => void;
  onSelectSheet: (sheetId: string) => void;
  onSelectGroup: (groupId: string) => void;
  onSheetSearchChange: (search: string) => void;
  onShowInfo: () => void;
  onRemoveSheetFromExport: (sheetId: string) => void;
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
  onShowInfo,
  onRemoveSheetFromExport,
}: UseSheetActionsParams) {
  const [draggingSheetId, setDraggingSheetId] = useState("");
  const [sheetDropTarget, setSheetDropTarget] = useState<SheetDropTarget | null>(null);

  function createSheet() {
    if (!activeProject) return;
    const sheet: WritingSheet = {
      id: `sheet-${Date.now()}`,
      title: "新的稿件卡片",
      groupId: activeGroupId || DEFAULT_CONTENT_GROUP_ID,
      type: "正文",
      status: "构思",
      targetWords: 1000,
      summary: "这张卡片的写作目标。",
      body: "# 新的稿件卡片\n\n",
      updatedAt: today(),
    };
    updateProject(activeProject.id, (project) => ({ ...project, updatedAt: today(), sheets: [...project.sheets, sheet] }));
    onSelectSheet(sheet.id);
  }

  function createMaterialSheet() {
    if (!activeProject) return;
    const materialGroupId = ensureMaterialGroup(activeProject).id;
    const sheet: WritingSheet = {
      id: `sheet-${Date.now()}`,
      title: "新的素材卡片",
      groupId: materialGroupId,
      type: "素材",
      status: "构思",
      targetWords: 500,
      summary: "记录事实、摘录、案例、图片方向或参考资料。",
      body: "# 新的素材卡片\n\n- 来源：\n- 关键事实：\n- 可用观点：\n",
      updatedAt: today(),
    };
    updateProject(activeProject.id, (project) => ({
      ...project,
      groups: ensureGroupExists(project.groups ?? createDefaultProjectGroups(), materialGroupId, "素材"),
      updatedAt: today(),
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
      const importedSheets = buildImportedMarkdownSheets(files, activeGroupId || DEFAULT_CONTENT_GROUP_ID);
      updateProject(activeProject.id, (project) => ({
        ...project,
        updatedAt: today(),
        sheets: [...project.sheets, ...importedSheets],
      }));
      onSelectSheet(importedSheets[0]?.id ?? activeSheetId);
      onSheetSearchChange("");
    } catch (error) {
      window.alert(`导入 Markdown 失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  function saveSuggestionAsMaterialSheet(suggestion: AiSuggestion) {
    if (!activeProject || !activeSheet || suggestion.reviewMode !== "note") return;
    const materialGroupId = ensureMaterialGroup(activeProject).id;
    const sheet: WritingSheet = {
      id: `sheet-${Date.now()}`,
      title: `${suggestion.title}｜${activeSheet.title}`,
      groupId: materialGroupId,
      type: "素材",
      status: "构思",
      targetWords: Math.max(300, countWords(suggestion.result)),
      summary: `AI 辅助生成，来源：${activeSheet.title}`,
      body: [
        `# ${suggestion.title}｜${activeSheet.title}`,
        "",
        `- 来源稿件：${activeSheet.title}`,
        `- 生成日期：${today()}`,
        `- 用途：${suggestion.title === "配图构思" ? "配图 / 生图提示词 / 视觉素材" : "稿件理解 / 结构复盘 / 写作规划"}`,
        "",
        suggestion.result,
      ].join("\n"),
      updatedAt: today(),
    };

    updateProject(activeProject.id, (project) => ({
      ...project,
      groups: ensureGroupExists(project.groups ?? createDefaultProjectGroups(), materialGroupId, "素材"),
      updatedAt: today(),
      sheets: [...project.sheets, sheet],
    }));
    onSelectGroup(materialGroupId);
    onSelectSheet(sheet.id);
    onSheetSearchChange("");
    onShowInfo();
  }

  function duplicateActiveSheet() {
    if (!activeProject || !activeSheet) return;
    const sourceIndex = activeProject.sheets.findIndex((sheet) => sheet.id === activeSheet.id);
    const sheet: WritingSheet = {
      ...activeSheet,
      id: `sheet-${Date.now()}`,
      title: `${activeSheet.title} 副本`,
      status: activeSheet.status === "已发布" || activeSheet.status === "已归档" ? "修改中" : activeSheet.status,
      updatedAt: today(),
      versions: [],
    };
    updateProject(activeProject.id, (project) => {
      const sheets = [...project.sheets];
      sheets.splice(sourceIndex >= 0 ? sourceIndex + 1 : sheets.length, 0, sheet);
      return { ...project, updatedAt: today(), sheets };
    });
    onSelectSheet(sheet.id);
  }

  function deleteActiveSheet() {
    if (!activeProject || !activeSheet) return;
    const confirmed = window.confirm(`删除稿件卡片「${activeSheet.title}」？这个操作会从当前项目中移除它。`);
    if (!confirmed) return;

    const sourceIndex = activeProject.sheets.findIndex((sheet) => sheet.id === activeSheet.id);
    const remaining = activeProject.sheets.filter((sheet) => sheet.id !== activeSheet.id);
    const fallbackSheet: WritingSheet = {
      id: `sheet-${Date.now()}`,
      title: "新的稿件卡片",
      groupId: activeSheet.groupId ?? activeGroupId ?? DEFAULT_CONTENT_GROUP_ID,
      type: "正文",
      status: "构思",
      targetWords: 1000,
      summary: "这张卡片的写作目标。",
      body: "# 新的稿件卡片\n\n",
      updatedAt: today(),
    };
    const nextSheets = remaining.length > 0 ? remaining : [fallbackSheet];
    const nextActiveSheet = nextSheets[Math.min(Math.max(sourceIndex, 0), nextSheets.length - 1)];

    updateProject(activeProject.id, (project) => ({
      ...project,
      updatedAt: today(),
      sheets: project.sheets.length > 1 ? project.sheets.filter((sheet) => sheet.id !== activeSheet.id) : [fallbackSheet],
    }));
    onRemoveSheetFromExport(activeSheet.id);
    onSelectSheet(nextActiveSheet.id);
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
      return { ...project, updatedAt: today(), sheets };
    });
  }

  function setSheetStatus(sheetId: string, status: ProjectStatus) {
    if (!activeProject) return;
    updateProject(activeProject.id, (project) => ({
      ...project,
      updatedAt: today(),
      sheets: project.sheets.map((sheet) => (sheet.id === sheetId ? { ...sheet, status, updatedAt: today() } : sheet)),
    }));
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
      return { ...project, updatedAt: today(), sheets };
    });
  }

  function handleSheetDragStart(event: DragEvent<HTMLElement>, sheetId: string) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", sheetId);
    setDraggingSheetId(sheetId);
  }

  function handleSheetDragOver(event: DragEvent<HTMLElement>, sheetId: string) {
    if (!draggingSheetId || draggingSheetId === sheetId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const bounds = event.currentTarget.getBoundingClientRect();
    const position = event.clientY < bounds.top + bounds.height / 2 ? "before" : "after";
    setSheetDropTarget({ sheetId, position });
  }

  function handleSheetDrop(event: DragEvent<HTMLElement>, targetSheetId: string) {
    event.preventDefault();
    const sourceSheetId = draggingSheetId || event.dataTransfer.getData("text/plain");
    const position = sheetDropTarget?.sheetId === targetSheetId ? sheetDropTarget.position : "before";
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
    saveSuggestionAsMaterialSheet,
    duplicateActiveSheet,
    deleteActiveSheet,
    moveSheet,
    setSheetStatus,
    handleSheetDragStart,
    handleSheetDragOver,
    handleSheetDrop,
    clearSheetDragState,
  };
}
