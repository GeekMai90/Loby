/**
 * [INPUT]: 依赖 shared 公共契约、写作库模块
 * [OUTPUT]: 对外提供 SHEET_DRAG_START_DISTANCE、SHEET_PROJECT_OPEN_DELAY_MS、SHEET_LIBRARY_RETURN_DELAY_MS、SheetDragHoverIntent、resolveSheetDragHoverIntent、resolveSheetMoveTarget、resolveSheetReorderTarget、sheetDragHoverDelay 等公开能力
 * [POS]: 写作库 feature 的领域模型边界，集中 写作库 规则、数据转换与外部契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { SheetDropTarget } from "@/shared/types";
import type { SheetMoveTarget } from "@/features/library/model/projectCreation";

export const SHEET_DRAG_START_DISTANCE = 4;
export const SHEET_PROJECT_OPEN_DELAY_MS = 800;
export const SHEET_LIBRARY_RETURN_DELAY_MS = 220;

export type SheetDragHoverIntent = { kind: "project"; projectId: string } | { kind: "library" };

export function resolveSheetDragHoverIntent(target: Element | null): SheetDragHoverIntent | null {
  const returnTarget = target?.closest<HTMLElement>("[data-sheet-drag-return-library]");
  if (returnTarget) return { kind: "library" };

  const projectTarget = target?.closest<HTMLElement>("[data-sheet-hover-project-id]");
  const projectId = projectTarget?.dataset.sheetHoverProjectId;
  return projectId ? { kind: "project", projectId } : null;
}

export function resolveSheetMoveTarget(target: Element | null): { element: HTMLElement; target: SheetMoveTarget } | null {
  const element = target?.closest<HTMLElement>("[data-sheet-move-project-id]");
  const projectId = element?.dataset.sheetMoveProjectId;
  if (!element || !projectId) return null;
  return {
    element,
    target: {
      projectId,
      groupId: element.dataset.sheetMoveGroupId || undefined,
    },
  };
}

export function resolveSheetReorderTarget(
  target: Element | null,
  sourceSheetId: string,
  clientY: number,
): { element: HTMLElement; target: SheetDropTarget } | null {
  const element = target?.closest<HTMLElement>(".sheet-row[data-sheet-id]");
  const sheetId = element?.dataset.sheetId;
  if (!element || !sheetId || sheetId === sourceSheetId) return null;
  const bounds = element.getBoundingClientRect();
  return {
    element,
    target: {
      sheetId,
      position: clientY < bounds.top + bounds.height / 2 ? "before" : "after",
    },
  };
}

export function sheetDragHoverDelay(intent: SheetDragHoverIntent): number {
  return intent.kind === "project" ? SHEET_PROJECT_OPEN_DELAY_MS : SHEET_LIBRARY_RETURN_DELAY_MS;
}

export function sameSheetDragHoverIntent(left: SheetDragHoverIntent | null, right: SheetDragHoverIntent | null): boolean {
  if (!left || !right || left.kind !== right.kind) return left === right;
  return left.kind === "library" || left.projectId === (right as { kind: "project"; projectId: string }).projectId;
}
