import type { WritingSheet } from "../types";

export function allExportSheetIds(publishableSheets: WritingSheet[]): string[] {
  return publishableSheets.map((sheet) => sheet.id);
}

export function getSelectedExportSheets(publishableSheets: WritingSheet[], selectedSheetIds: string[]): WritingSheet[] {
  return selectedSheetIds
    .map((id) => publishableSheets.find((sheet) => sheet.id === id))
    .filter((sheet): sheet is WritingSheet => Boolean(sheet));
}

export function pruneExportSelection(selectedSheetIds: string[], publishableSheets: WritingSheet[]): string[] {
  const publishableIds = new Set(publishableSheets.map((sheet) => sheet.id));
  return selectedSheetIds.filter((id) => publishableIds.has(id));
}

export function toggleExportSheetId(selectedSheetIds: string[], sheetId: string): string[] {
  return selectedSheetIds.includes(sheetId) ? selectedSheetIds.filter((id) => id !== sheetId) : [...selectedSheetIds, sheetId];
}

export function moveExportSheetId(selectedSheetIds: string[], sheetId: string, direction: -1 | 1): string[] {
  const index = selectedSheetIds.indexOf(sheetId);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= selectedSheetIds.length) return selectedSheetIds;
  const next = [...selectedSheetIds];
  [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
  return next;
}
