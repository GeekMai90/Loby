/**
 * [INPUT]: 依赖 React callback、assistant AI 动作目标解析、library 项目类型判定，以及 App 注入的工作区与动作写回能力
 * [OUTPUT]: 对外提供 useAiActionTargetNavigation，返回 AI 动作卡片的目标定位动作
 * [POS]: app 组合层的 AI 动作目标导航边界；协调错误反馈、文稿/项目切换与 Inspector 打开，不执行动作或持久化正文
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useCallback } from "react";
import { resolveAiActionNavigationTarget } from "@/features/assistant/model/aiActionNavigation";
import { isNotesProject, type ProjectFilter } from "@/features/library/model/projectModel";
import type { AiAction, SidebarMode, WritingProject } from "@/shared/types";

interface UseAiActionTargetNavigationOptions {
  actions: AiAction[];
  projects: WritingProject[];
  onActionChange: (actionId: string, updater: (action: AiAction) => AiAction) => void;
  onSheetSelect: (sheetId: string) => void;
  onSheetFiltersReset: () => void;
  onInspectorOpenChange: (open: boolean) => void;
  onLibraryStatusChange: (status: string) => void;
  onProjectFilterChange: (filter: ProjectFilter) => void;
  onActiveProjectChange: (projectId: string) => void;
  onActiveSheetChange: (sheetId: string) => void;
  onActiveGroupChange: (groupId: string) => void;
  onActiveNoteGroupChange: (groupId: string) => void;
  onSidebarModeChange: (mode: SidebarMode) => void;
  onRememberProjectGroup: (projectId: string, groupId: string) => void;
}

export function useAiActionTargetNavigation({
  actions,
  projects,
  onActionChange,
  onSheetSelect,
  onSheetFiltersReset,
  onInspectorOpenChange,
  onLibraryStatusChange,
  onProjectFilterChange,
  onActiveProjectChange,
  onActiveSheetChange,
  onActiveGroupChange,
  onActiveNoteGroupChange,
  onSidebarModeChange,
  onRememberProjectGroup,
}: UseAiActionTargetNavigationOptions) {
  const openAiActionTarget = useCallback(
    (actionId: string) => {
      const action = actions.find((item) => item.id === actionId);
      if (!action) return;
      const target = resolveAiActionNavigationTarget(action, projects);
      if (!target.ok) {
        onLibraryStatusChange(target.message);
        onActionChange(actionId, (item) => ({ ...item, error: target.message }));
        return;
      }

      if (target.sheetId) {
        const ownerProject = projects.find((project) => project.sheets.some((sheet) => sheet.id === target.sheetId));
        if (ownerProject && !isNotesProject(ownerProject)) onProjectFilterChange("active");
        onSheetSelect(target.sheetId);
        onSheetFiltersReset();
        onInspectorOpenChange(true);
        onLibraryStatusChange(`已切回 AI 动作目标文稿「${target.sheetTitle || target.sheetId}」。`);
        return;
      }

      const targetProject = projects.find((project) => project.id === target.projectId);
      if (!targetProject) return;
      const groupId = target.groupId ?? targetProject.groups?.[0]?.id ?? "";
      onActiveProjectChange(targetProject.id);
      onActiveGroupChange(groupId);
      onActiveSheetChange("");
      onSheetFiltersReset();
      onInspectorOpenChange(true);
      if (isNotesProject(targetProject)) {
        onSidebarModeChange("library");
        onActiveNoteGroupChange(groupId);
      } else {
        onSidebarModeChange("project");
        onProjectFilterChange("active");
        onActiveNoteGroupChange("");
        if (groupId) onRememberProjectGroup(targetProject.id, groupId);
      }
      onLibraryStatusChange(`已切回 AI 动作目标项目「${target.projectTitle}」。`);
    },
    [
      actions,
      onActionChange,
      onActiveGroupChange,
      onActiveNoteGroupChange,
      onActiveProjectChange,
      onActiveSheetChange,
      onInspectorOpenChange,
      onLibraryStatusChange,
      onProjectFilterChange,
      onRememberProjectGroup,
      onSheetFiltersReset,
      onSheetSelect,
      onSidebarModeChange,
      projects,
    ],
  );

  return { openAiActionTarget };
}
