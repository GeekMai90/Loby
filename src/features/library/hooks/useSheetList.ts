/**
 * [INPUT]: 依赖 React 运行时、shared 公共契约、写作库模块
 * [OUTPUT]: 对外提供 useSheetList
 * [POS]: 写作库 feature 的React 协调边界，封装 写作库 状态、副作用与用户动作
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useMemo, type Dispatch, type SetStateAction } from "react";
import type {
  SheetManualOrders,
  SheetSortDirection,
  SheetSortMode,
  SheetSortPreference,
  SidebarMode,
  WritingProject,
} from "@/shared/types";
import { today } from "@/shared/lib/dates";
import type { ProjectFilter } from "@/features/library/model/projectModel";
import {
  createFilteredSheetListModel,
  createSheetListContext,
  updateSheetSortPreferences,
  updateVisibleSheetManualOrder,
  type CreateSheetListModelOptions,
} from "@/features/library/model/sheetListModel";
import type { RailDropPosition } from "@/features/library/model/sheetSorting";

interface UseSheetListOptions extends Omit<
  CreateSheetListModelOptions,
  "activeProject" | "currentDay" | "sheetSortPreferences" | "sheetManualOrders"
> {
  activeProject: WritingProject | undefined;
  sidebarMode: SidebarMode;
  projectFilter: ProjectFilter;
  sheetSortPreferences: Record<string, SheetSortPreference>;
  sheetManualOrders: SheetManualOrders;
  onSheetSortPreferencesChange: Dispatch<SetStateAction<Record<string, SheetSortPreference>>>;
  onSheetManualOrdersChange: Dispatch<SetStateAction<SheetManualOrders>>;
}

export function useSheetList({
  projects,
  activeProject,
  activeSheetId,
  activeGroupId,
  activeNoteGroupId,
  sidebarMode,
  projectFilter,
  sheetSearch,
  sheetSortPreferences,
  sheetManualOrders,
  onSheetSortPreferencesChange,
  onSheetManualOrdersChange,
}: UseSheetListOptions) {
  const currentDay = today();
  const context = useMemo(
    () =>
      createSheetListContext({
        projects,
        activeProject,
        activeSheetId,
        activeGroupId,
        activeNoteGroupId,
        sidebarMode,
        projectFilter,
        currentDay,
      }),
    [activeGroupId, activeNoteGroupId, activeProject, activeSheetId, currentDay, projectFilter, projects, sidebarMode],
  );
  const filteredList = useMemo(
    () =>
      createFilteredSheetListModel({
        sourceSheets: context.sourceSheets,
        sortPreferenceKey: context.sortPreferenceKey,
        activeSheetId,
        sheetSearch,
        sheetSortPreferences,
        sheetManualOrders,
        manualReorderContextAllowed: context.manualReorderContextAllowed,
      }),
    [activeSheetId, context, sheetManualOrders, sheetSearch, sheetSortPreferences],
  );
  const model = { ...context, ...filteredList };

  function updateSortPreference(nextPreference: Partial<SheetSortPreference>) {
    onSheetSortPreferencesChange((current) => updateSheetSortPreferences(current, model.sortPreferenceKey, nextPreference));
  }

  function updateSortMode(mode: SheetSortMode) {
    updateSortPreference({ mode });
  }

  function updateSortDirection(direction: SheetSortDirection) {
    updateSortPreference({ direction });
  }

  function updateManualOrder(sourceSheetId: string, targetSheetId: string, position: RailDropPosition) {
    const visibleSheetIds = model.filteredSheets.map((sheet) => sheet.id);
    onSheetManualOrdersChange((current) =>
      updateVisibleSheetManualOrder(current, model.sortPreferenceKey, visibleSheetIds, sourceSheetId, targetSheetId, position),
    );
  }

  return {
    ...model,
    updateSortMode,
    updateSortDirection,
    updateManualOrder,
  };
}
