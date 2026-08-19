/**
 * [INPUT]: 依赖可见文稿 ID、当前活动文稿、列表修饰键选择规则与 App 注入的文稿导航回调
 * [OUTPUT]: 对外提供 useSheetSelection，维护多选文稿、锚点、可见范围修复与列表选择动作
 * [POS]: library feature 的文稿选择协调边界；不拥有项目导航、右键菜单、拖拽或文稿持久化
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { startTransition, useCallback, useEffect, useState } from "react";
import type { ProjectFilter } from "@/features/library/model/projectModel";
import { pruneSheetSelection, resolveSheetSelection, type SheetSelectionModifiers } from "@/features/library/model/sheetSelection";

interface UseSheetSelectionOptions {
  initialSheetId: string;
  activeSheetId: string;
  projectFilter: ProjectFilter;
  visibleSheetIds: string[];
  onActiveSheetChange: (sheetId: string) => void;
  onSelectSheet: (sheetId: string) => void;
}

export function useSheetSelection({
  initialSheetId,
  activeSheetId,
  projectFilter,
  visibleSheetIds,
  onActiveSheetChange,
  onSelectSheet,
}: UseSheetSelectionOptions) {
  const [selectedSheetIds, setSelectedSheetIds] = useState<string[]>(() => (initialSheetId ? [initialSheetId] : []));
  const [sheetSelectionAnchorId, setSheetSelectionAnchorId] = useState(initialSheetId);

  useEffect(() => {
    if (projectFilter === "trash") return;
    setSelectedSheetIds((current) => {
      const pruned = pruneSheetSelection(current, visibleSheetIds);
      if (activeSheetId && visibleSheetIds.includes(activeSheetId) && !pruned.includes(activeSheetId)) return [activeSheetId];
      if (!activeSheetId) return [];
      return pruned;
    });
    setSheetSelectionAnchorId((current) =>
      visibleSheetIds.includes(current) ? current : activeSheetId && visibleSheetIds.includes(activeSheetId) ? activeSheetId : "",
    );
  }, [activeSheetId, projectFilter, visibleSheetIds]);

  const selectSheetFromList = useCallback(
    (sheetId: string, modifiers: SheetSelectionModifiers) => {
      const next = resolveSheetSelection({
        selectedSheetIds,
        anchorSheetId: sheetSelectionAnchorId,
        visibleSheetIds,
        sheetId,
        modifiers,
      });
      setSelectedSheetIds(next.selectedSheetIds);
      setSheetSelectionAnchorId(next.anchorSheetId);

      const nextActiveSheetId = next.selectedSheetIds.includes(sheetId)
        ? sheetId
        : (next.selectedSheetIds[next.selectedSheetIds.length - 1] ?? "");
      if (nextActiveSheetId) {
        startTransition(() => onSelectSheet(nextActiveSheetId));
      } else onActiveSheetChange("");
    },
    [onActiveSheetChange, onSelectSheet, selectedSheetIds, sheetSelectionAnchorId, visibleSheetIds],
  );

  const clearSheetSelection = useCallback(() => {
    setSelectedSheetIds([]);
    setSheetSelectionAnchorId("");
    onActiveSheetChange("");
  }, [onActiveSheetChange]);

  return {
    selectedSheetIds,
    setSelectedSheetIds,
    sheetSelectionAnchorId,
    setSheetSelectionAnchorId,
    selectSheetFromList,
    clearSheetSelection,
  };
}
