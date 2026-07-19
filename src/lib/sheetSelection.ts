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

export function pruneSheetSelection(selectedSheetIds: string[], visibleSheetIds: string[]): string[] {
  const visible = new Set(visibleSheetIds);
  const pruned = selectedSheetIds.filter((id) => visible.has(id));
  return pruned.length === selectedSheetIds.length ? selectedSheetIds : pruned;
}

function mergeVisibleSelection(selectedSheetIds: string[], range: string[], visibleSheetIds: string[]): string[] {
  const selected = new Set([...selectedSheetIds, ...range]);
  return visibleSheetIds.filter((id) => selected.has(id));
}
