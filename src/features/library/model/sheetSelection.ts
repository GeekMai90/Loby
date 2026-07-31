/**
 * [INPUT]: 依赖 同目录稳定契约
 * [OUTPUT]: 对外提供 SheetSelectionModifiers、ResolveSheetSelectionOptions、SheetSelectionResult、resolveSheetSelection、resolveContextSheetSelection、resolveFirstRemainingSheetId、pruneSheetSelection
 * [POS]: 写作库 feature 的领域模型边界，集中 写作库 规则、数据转换与外部契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
export interface SheetSelectionModifiers {
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
}

export interface ResolveSheetSelectionOptions {
  selectedSheetIds: string[];
  anchorSheetId: string;
  visibleSheetIds: string[];
  sheetId: string;
  modifiers: SheetSelectionModifiers;
}

export interface SheetSelectionResult {
  selectedSheetIds: string[];
  anchorSheetId: string;
}

export function resolveSheetSelection({
  selectedSheetIds,
  anchorSheetId,
  visibleSheetIds,
  sheetId,
  modifiers,
}: ResolveSheetSelectionOptions): SheetSelectionResult {
  const additive = modifiers.metaKey || modifiers.ctrlKey;
  const clickedIndex = visibleSheetIds.indexOf(sheetId);

  if (modifiers.shiftKey && clickedIndex >= 0) {
    const anchorIndex = visibleSheetIds.indexOf(anchorSheetId);
    if (anchorIndex >= 0) {
      const range = visibleSheetIds.slice(Math.min(anchorIndex, clickedIndex), Math.max(anchorIndex, clickedIndex) + 1);
      return {
        selectedSheetIds: additive ? mergeVisibleSelection(selectedSheetIds, range, visibleSheetIds) : range,
        anchorSheetId,
      };
    }
  }

  if (additive) {
    const selected = new Set(selectedSheetIds);
    if (selected.has(sheetId)) selected.delete(sheetId);
    else selected.add(sheetId);
    return {
      selectedSheetIds: visibleSheetIds.filter((id) => selected.has(id)),
      anchorSheetId: sheetId,
    };
  }

  return { selectedSheetIds: [sheetId], anchorSheetId: sheetId };
}

export function resolveContextSheetSelection(selectedSheetIds: string[], sheetId: string): string[] {
  return selectedSheetIds.includes(sheetId) ? selectedSheetIds : [sheetId];
}

export function resolveFirstRemainingSheetId(visibleSheetIds: string[], deletedSheetIds: string[], fallbackSheetId = ""): string {
  const deleted = new Set(deletedSheetIds);
  return visibleSheetIds.find((sheetId) => !deleted.has(sheetId)) ?? fallbackSheetId;
}

export function pruneSheetSelection(selectedSheetIds: string[], visibleSheetIds: string[]): string[] {
  const visible = new Set(visibleSheetIds);
  const pruned = selectedSheetIds.filter((id) => visible.has(id));
  return pruned.length === selectedSheetIds.length ? selectedSheetIds : pruned;
}

function mergeVisibleSelection(selectedSheetIds: string[], range: string[], visibleSheetIds: string[]): string[] {
  const selected = new Set([...selectedSheetIds, ...range]);
  return visibleSheetIds.filter((id) => selected.has(id));
}
