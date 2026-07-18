import { useEffect, useEffectEvent, useRef, useState, type MouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import type { SheetDropTarget, WritingSheet } from "../types";
import type { SheetMoveTarget } from "../lib/projectCreation";
import {
  resolveSheetDragHoverIntent,
  resolveSheetMoveTarget,
  resolveSheetReorderTarget,
  sameSheetDragHoverIntent,
  sheetDragHoverDelay,
  SHEET_DRAG_START_DISTANCE,
  type SheetDragHoverIntent,
} from "../lib/sheetDrag";
import { getSheetDisplayTitle, getSheetMetaText } from "../lib/sheetRail";

interface SheetPointerDragSession {
  sheetId: string;
  pointerId: number;
  startX: number;
  startY: number;
  active: boolean;
}

export interface SheetDragPreviewState {
  title: string;
  meta: string;
  x: number;
  y: number;
}

interface UseSheetPointerDragOptions {
  sheets: WritingSheet[];
  sheetProjectTitleById: Record<string, string>;
  canReorderSheets: boolean;
  canMoveSheets: boolean;
  onSheetReorderStart: (sheetId: string) => void;
  onSheetReorderPreview: (target: SheetDropTarget | null) => void;
  onSheetReorderCommit: (sourceSheetId: string, targetSheetId: string, position: SheetDropTarget["position"]) => void;
  onSheetReorderEnd: () => void;
  onSheetMoveCommit: (sheetId: string, target: SheetMoveTarget) => void;
  onSheetDragPreviewProject: (projectId: string) => void;
  onSheetDragPreviewLibrary: () => void;
  onSheetDragPreviewClear: () => void;
}

function hoverIntentElement(target: Element | null, intent: SheetDragHoverIntent | null): HTMLElement | null {
  if (!intent) return null;
  return intent.kind === "library"
    ? (target?.closest<HTMLElement>("[data-sheet-drag-return-library]") ?? null)
    : (target?.closest<HTMLElement>("[data-sheet-hover-project-id]") ?? null);
}

export function useSheetPointerDrag(options: UseSheetPointerDragOptions) {
  const pointerDragRef = useRef<SheetPointerDragSession | null>(null);
  const dropTargetRef = useRef<SheetDropTarget | null>(null);
  const moveTargetRef = useRef<SheetMoveTarget | null>(null);
  const moveTargetElementRef = useRef<HTMLElement | null>(null);
  const hoverIntentRef = useRef<SheetDragHoverIntent | null>(null);
  const hoverIntentElementRef = useRef<HTMLElement | null>(null);
  const hoverTimerRef = useRef<number | null>(null);
  const suppressNextClickRef = useRef(false);
  const [listening, setListening] = useState(false);
  const [dragPreview, setDragPreview] = useState<SheetDragPreviewState | null>(null);

  function clearHoverIntent() {
    if (hoverTimerRef.current !== null) window.clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = null;
    hoverIntentElementRef.current?.classList.remove("sheet-drag-hover-pending");
    hoverIntentElementRef.current = null;
    hoverIntentRef.current = null;
  }

  function clearMoveTarget() {
    moveTargetElementRef.current?.classList.remove("sheet-move-target");
    moveTargetElementRef.current = null;
    moveTargetRef.current = null;
  }

  function scheduleHoverIntent(intent: SheetDragHoverIntent | null, element: HTMLElement | null) {
    if (!intent || !element) {
      clearHoverIntent();
      return;
    }
    if (sameSheetDragHoverIntent(hoverIntentRef.current, intent)) return;
    clearHoverIntent();
    hoverIntentRef.current = intent;
    hoverIntentElementRef.current = element;
    element.classList.add("sheet-drag-hover-pending");
    hoverTimerRef.current = window.setTimeout(() => {
      element.classList.remove("sheet-drag-hover-pending");
      hoverTimerRef.current = null;
      hoverIntentElementRef.current = null;
      hoverIntentRef.current = null;
      if (intent.kind === "project") options.onSheetDragPreviewProject(intent.projectId);
      else options.onSheetDragPreviewLibrary();
    }, sheetDragHoverDelay(intent));
  }

  function resetSession() {
    clearHoverIntent();
    clearMoveTarget();
    pointerDragRef.current = null;
    dropTargetRef.current = null;
    setDragPreview(null);
    setListening(false);
    document.body.classList.remove("dragging-sheet-card");
  }

  function finishSession(commit: boolean) {
    const session = pointerDragRef.current;
    const finalMoveTarget = moveTargetRef.current;
    const finalDropTarget = dropTargetRef.current;
    if (session?.active) suppressNextClickRef.current = true;

    if (commit && session?.active && finalMoveTarget) {
      options.onSheetMoveCommit(session.sheetId, finalMoveTarget);
      options.onSheetReorderEnd();
    } else if (commit && session?.active && finalDropTarget) {
      options.onSheetReorderCommit(session.sheetId, finalDropTarget.sheetId, finalDropTarget.position);
    } else if (session?.active) {
      options.onSheetReorderEnd();
    }
    options.onSheetDragPreviewClear();
    resetSession();
  }

  const handlePointerMove = useEffectEvent((event: PointerEvent) => {
    const session = pointerDragRef.current;
    if (!session || event.pointerId !== session.pointerId) return;
    const distance = Math.hypot(event.clientX - session.startX, event.clientY - session.startY);
    if (!session.active && distance < SHEET_DRAG_START_DISTANCE) return;
    if (!session.active) {
      session.active = true;
      const sheet = options.sheets.find((item) => item.id === session.sheetId);
      if (!sheet) {
        finishSession(false);
        return;
      }
      document.body.classList.add("dragging-sheet-card");
      options.onSheetReorderStart(session.sheetId);
      setDragPreview({
        title: getSheetDisplayTitle(sheet),
        meta: getSheetMetaText(sheet, options.sheetProjectTitleById[sheet.id]),
        x: event.clientX,
        y: event.clientY,
      });
    } else {
      setDragPreview((current) => (current ? { ...current, x: event.clientX, y: event.clientY } : current));
    }
    event.preventDefault();

    const hit = document.elementFromPoint(event.clientX, event.clientY);
    const hoverIntent = resolveSheetDragHoverIntent(hit);
    const moveTarget = options.canMoveSheets ? resolveSheetMoveTarget(hit) : null;
    scheduleHoverIntent(hoverIntent, hoverIntentElement(hit, hoverIntent));

    clearMoveTarget();
    if (moveTarget) {
      moveTargetRef.current = moveTarget.target;
      moveTargetElementRef.current = moveTarget.element;
      moveTarget.element.classList.add("sheet-move-target");
      dropTargetRef.current = null;
      options.onSheetReorderPreview(null);
      return;
    }

    if (!options.canReorderSheets) {
      dropTargetRef.current = null;
      options.onSheetReorderPreview(null);
      return;
    }
    const reorderTarget = resolveSheetReorderTarget(hit, session.sheetId, event.clientY);
    dropTargetRef.current = reorderTarget?.target ?? null;
    options.onSheetReorderPreview(reorderTarget?.target ?? null);
  });

  const handlePointerUp = useEffectEvent((event: PointerEvent) => {
    if (event.pointerId !== pointerDragRef.current?.pointerId) return;
    if (pointerDragRef.current.active) {
      event.preventDefault();
      event.stopPropagation();
    }
    finishSession(true);
  });

  const handlePointerCancel = useEffectEvent((event: PointerEvent) => {
    if (event.pointerId === pointerDragRef.current?.pointerId) finishSession(false);
  });

  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.key !== "Escape" || !pointerDragRef.current?.active) return;
    event.preventDefault();
    event.stopPropagation();
    finishSession(false);
  });

  useEffect(() => {
    if (!listening) return;

    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", handlePointerUp, true);
    window.addEventListener("pointercancel", handlePointerCancel, true);
    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp, true);
      window.removeEventListener("pointercancel", handlePointerCancel, true);
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [listening]);

  useEffect(
    () => () => {
      if (hoverTimerRef.current !== null) window.clearTimeout(hoverTimerRef.current);
      moveTargetElementRef.current?.classList.remove("sheet-move-target");
      hoverIntentElementRef.current?.classList.remove("sheet-drag-hover-pending");
      document.body.classList.remove("dragging-sheet-card");
    },
    [],
  );

  function startSheetPointerDrag(sheetId: string, event: ReactPointerEvent<HTMLElement>) {
    if ((!options.canReorderSheets && !options.canMoveSheets) || event.button !== 0) return;
    pointerDragRef.current = {
      sheetId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      active: false,
    };
    dropTargetRef.current = null;
    moveTargetRef.current = null;
    setListening(true);
  }

  function suppressClickAfterDrag(event: MouseEvent<HTMLElement>): boolean {
    if (!suppressNextClickRef.current) return false;
    suppressNextClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
    return true;
  }

  return {
    dragPreview,
    startSheetPointerDrag,
    suppressClickAfterDrag,
  };
}
