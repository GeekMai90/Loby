/**
 * [INPUT]: 依赖 React 运行时、shared 公共契约、写作库模块
 * [OUTPUT]: 对外提供 SheetDragPreviewState、useSheetPointerDrag；同步捕获主指针，并在按键释放、捕获丢失、窗口失焦或页面隐藏时清理拖拽会话
 * [POS]: 写作库 feature 的拖拽状态机边界，冻结项目 Drop 选集并阻止松开主键后的陈旧会话误激活
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useEffect, useEffectEvent, useRef, useState, type MouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import type { SheetDropTarget, WritingSheet } from "@/shared/types";
import type { SheetMoveTarget } from "@/features/library/model/projectCreation";
import {
  resolveSheetDragHoverIntent,
  resolveSheetMoveTarget,
  resolveSheetReorderTarget,
  sameSheetDragHoverIntent,
  sheetDragHoverDelay,
  SHEET_DRAG_START_DISTANCE,
  type SheetDragHoverIntent,
} from "@/features/library/model/sheetDrag";
import { getSheetDisplayTitle, getSheetMetaText } from "@/features/library/model/sheetRail";

interface SheetPointerDragSession {
  sheetId: string;
  sheetIds: string[];
  pointerId: number;
  pointerType: string;
  sourceElement: HTMLElement;
  lostPointerCaptureHandler: (event: PointerEvent) => void;
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
  sheetMetaLabelById: Record<string, string>;
  selectedSheetIds: string[];
  canReorderSheets: boolean;
  canMoveSheets: boolean;
  onSheetReorderStart: (sheetId: string) => void;
  onSheetReorderPreview: (target: SheetDropTarget | null) => void;
  onSheetReorderCommit: (sourceSheetId: string, targetSheetId: string, position: SheetDropTarget["position"]) => void;
  onSheetReorderEnd: () => void;
  onSheetMoveCommit: (sheetIds: string[], target: SheetMoveTarget) => void;
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

function releaseSessionPointer(session: SheetPointerDragSession) {
  session.sourceElement.removeEventListener("lostpointercapture", session.lostPointerCaptureHandler);
  try {
    if (session.sourceElement.hasPointerCapture?.(session.pointerId)) {
      session.sourceElement.releasePointerCapture?.(session.pointerId);
    }
  } catch {
    // WebView 可能已在 pointerup、窗口失焦或节点卸载时自动释放捕获。
  }
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
    const session = pointerDragRef.current;
    pointerDragRef.current = null;
    if (session) releaseSessionPointer(session);
    clearHoverIntent();
    clearMoveTarget();
    dropTargetRef.current = null;
    setDragPreview(null);
    document.body.classList.remove("dragging-sheet-card");
  }

  function finishSession(commit: boolean) {
    const session = pointerDragRef.current;
    const finalMoveTarget = moveTargetRef.current;
    const finalDropTarget = dropTargetRef.current;
    if (session?.active) suppressNextClickRef.current = true;

    if (commit && session?.active && finalMoveTarget) {
      options.onSheetMoveCommit(session.sheetIds, finalMoveTarget);
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
    if (session.pointerType !== "touch" && (event.buttons & 1) === 0) {
      finishSession(false);
      return;
    }
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
        meta: getSheetMetaText(sheet, options.sheetMetaLabelById[sheet.id]),
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
    if (event.key !== "Escape" || !pointerDragRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    finishSession(false);
  });

  const handleWindowBlur = useEffectEvent(() => {
    if (pointerDragRef.current) finishSession(false);
  });

  const handleVisibilityChange = useEffectEvent(() => {
    if (document.hidden && pointerDragRef.current) finishSession(false);
  });

  useEffect(() => {
    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", handlePointerUp, true);
    window.addEventListener("pointercancel", handlePointerCancel, true);
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("blur", handleWindowBlur);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp, true);
      window.removeEventListener("pointercancel", handlePointerCancel, true);
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("blur", handleWindowBlur);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(
    () => () => {
      const session = pointerDragRef.current;
      pointerDragRef.current = null;
      if (session) releaseSessionPointer(session);
      if (hoverTimerRef.current !== null) window.clearTimeout(hoverTimerRef.current);
      moveTargetElementRef.current?.classList.remove("sheet-move-target");
      hoverIntentElementRef.current?.classList.remove("sheet-drag-hover-pending");
      document.body.classList.remove("dragging-sheet-card");
    },
    [],
  );

  function startSheetPointerDrag(sheetId: string, event: ReactPointerEvent<HTMLElement>) {
    if ((!options.canReorderSheets && !options.canMoveSheets) || event.button !== 0 || !event.isPrimary) return;
    if (pointerDragRef.current) finishSession(false);
    const sourceElement = event.currentTarget;
    const lostPointerCaptureHandler = (captureEvent: PointerEvent) => {
      if (captureEvent.pointerId === pointerDragRef.current?.pointerId) finishSession(false);
    };
    pointerDragRef.current = {
      sheetId,
      sheetIds: options.selectedSheetIds.includes(sheetId) ? [...options.selectedSheetIds] : [sheetId],
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      sourceElement,
      lostPointerCaptureHandler,
      startX: event.clientX,
      startY: event.clientY,
      active: false,
    };
    dropTargetRef.current = null;
    moveTargetRef.current = null;
    sourceElement.addEventListener("lostpointercapture", lostPointerCaptureHandler);
    try {
      sourceElement.setPointerCapture?.(event.pointerId);
    } catch {
      // 极旧 WebView 或已经失效的指针仍由全局监听和 buttons 校验兜底。
    }
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
