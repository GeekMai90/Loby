/**
 * [INPUT]: 依赖 React transition/state、library 全局搜索目标解析，以及 App 注入的工作区选择与 rail 动作
 * [OUTPUT]: 对外提供 useGlobalSearchNavigation，返回全局搜索结果打开动作与一次性列表滚动请求
 * [POS]: app 组合层的全局搜索导航事务边界；原子协调搜索关闭、列表选择、浏览上下文与滚动定位，不拥有搜索查询或持久化
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { startTransition, useRef, useState } from "react";
import { resolveGlobalSearchNavigationTarget } from "@/features/library/model/workspaceSelection";
import type { SidebarMode, WritingProject } from "@/shared/types";
import type { ProjectFilter } from "@/features/library/model/projectModel";

interface UseGlobalSearchNavigationOptions {
  projects: WritingProject[];
  onSearchClose: () => void;
  onSheetFiltersReset: () => void;
  onSheetListRailShow: () => void;
  onSingleSheetSelect: (sheetId: string) => void;
  onSheetListActivate: () => void;
  onActiveProjectChange: (projectId: string) => void;
  onActiveSheetChange: (sheetId: string) => void;
  onActiveNoteGroupChange: (groupId: string) => void;
  onProjectFilterChange: (filter: ProjectFilter) => void;
  onSidebarModeChange: (mode: SidebarMode) => void;
  onActiveGroupChange: (groupId: string) => void;
  onRememberProjectGroup: (projectId: string, groupId: string) => void;
}

export function useGlobalSearchNavigation({
  projects,
  onSearchClose,
  onSheetFiltersReset,
  onSheetListRailShow,
  onSingleSheetSelect,
  onSheetListActivate,
  onActiveProjectChange,
  onActiveSheetChange,
  onActiveNoteGroupChange,
  onProjectFilterChange,
  onSidebarModeChange,
  onActiveGroupChange,
  onRememberProjectGroup,
}: UseGlobalSearchNavigationOptions) {
  const [sheetScrollRequest, setSheetScrollRequest] = useState<{ sheetId: string; requestId: number } | null>(null);
  const sheetScrollRequestIdRef = useRef(0);

  function openGlobalSearchResult(sheetId: string, mode: "all" | "project") {
    const target = resolveGlobalSearchNavigationTarget(projects, sheetId, mode);
    if (!target) return;

    onSearchClose();
    onSheetFiltersReset();
    onSheetListRailShow();
    onSingleSheetSelect(sheetId);
    onSheetListActivate();
    if (target.requestListScroll) {
      sheetScrollRequestIdRef.current += 1;
      setSheetScrollRequest({ sheetId, requestId: sheetScrollRequestIdRef.current });
    }

    startTransition(() => {
      const { selection } = target;
      if (selection.activeProjectId !== undefined) onActiveProjectChange(selection.activeProjectId);
      if (selection.activeSheetId !== undefined) onActiveSheetChange(selection.activeSheetId);
      if (selection.activeNoteGroupId !== undefined) onActiveNoteGroupChange(selection.activeNoteGroupId);
      if (selection.projectFilter !== undefined) onProjectFilterChange(selection.projectFilter);
      if (selection.sidebarMode !== undefined) onSidebarModeChange(selection.sidebarMode);
      if (selection.activeGroupId !== undefined) onActiveGroupChange(selection.activeGroupId);
      if (selection.rememberedGroup) {
        onRememberProjectGroup(selection.rememberedGroup.projectId, selection.rememberedGroup.groupId);
      }
    });
  }

  return { openGlobalSearchResult, sheetScrollRequest };
}
