import { useMemo, type Dispatch, type SetStateAction } from "react";
import type { SheetManualOrders, SheetSortDirection, SheetSortMode, SheetSortPreference, SidebarMode, WritingProject } from "../types";
import { today } from "../lib/dates";
import type { ProjectFilter } from "../lib/projectModel";
import {
  createFilteredSheetListModel,
  createSheetListContext,
  updateSheetSortPreferences,
  updateVisibleSheetManualOrder,
  type CreateSheetListModelOptions,
} from "../lib/sheetListModel";
import type { RailDropPosition } from "../lib/sheetSorting";

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
