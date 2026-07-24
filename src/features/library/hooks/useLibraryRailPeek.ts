/**
 * [INPUT]: 依赖 React 运行时与调用方提供的可用性、交互锁和浮层占用判断
 * [OUTPUT]: 对外提供 useLibraryRailPeek、唤出/收回延迟常量与支持原生窗口边缘桥接的指针处理器
 * [POS]: 写作库 feature 的临时导航协调器，将边缘悬停预览与正式 rail 展开状态隔离
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

export const LIBRARY_RAIL_PEEK_OPEN_DELAY_MS = 150;
export const LIBRARY_RAIL_PEEK_CLOSE_DELAY_MS = 250;
export const LIBRARY_RAIL_PEEK_NATIVE_EDGE_MAX_X = 2;

interface UseLibraryRailPeekOptions {
  enabled: boolean;
  interactionLocked?: boolean;
  hasOpenOverlay?: () => boolean;
}

interface HoverState {
  edge: boolean;
  rail: boolean;
  trigger: boolean;
}

export function useLibraryRailPeek({ enabled, interactionLocked = false, hasOpenOverlay }: UseLibraryRailPeekOptions) {
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverRef = useRef<HoverState>({ edge: false, rail: false, trigger: false });
  const optionsRef = useRef({ enabled, interactionLocked, hasOpenOverlay });

  useEffect(() => {
    optionsRef.current = { enabled, interactionLocked, hasOpenOverlay };
  }, [enabled, hasOpenOverlay, interactionLocked]);

  const clearOpenTimer = useCallback(() => {
    if (!openTimerRef.current) return;
    clearTimeout(openTimerRef.current);
    openTimerRef.current = null;
  }, []);

  const clearCloseTimer = useCallback(() => {
    if (!closeTimerRef.current) return;
    clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  }, []);

  const commitOpen = useCallback((nextOpen: boolean) => {
    openRef.current = nextOpen;
    setOpen(nextOpen);
  }, []);

  const closeNow = useCallback(() => {
    clearOpenTimer();
    clearCloseTimer();
    hoverRef.current = { edge: false, rail: false, trigger: false };
    commitOpen(false);
  }, [clearCloseTimer, clearOpenTimer, commitOpen]);

  const scheduleClose = useCallback(() => {
    clearOpenTimer();
    clearCloseTimer();
    if (!openRef.current || hoverRef.current.edge || hoverRef.current.rail || hoverRef.current.trigger) return;

    function attemptClose() {
      closeTimerRef.current = null;
      const currentOptions = optionsRef.current;
      if (!currentOptions.enabled) {
        commitOpen(false);
        return;
      }
      if (hoverRef.current.edge || hoverRef.current.rail || hoverRef.current.trigger) return;
      if (currentOptions.interactionLocked || currentOptions.hasOpenOverlay?.()) {
        closeTimerRef.current = setTimeout(attemptClose, LIBRARY_RAIL_PEEK_CLOSE_DELAY_MS);
        return;
      }
      commitOpen(false);
    }

    closeTimerRef.current = setTimeout(attemptClose, LIBRARY_RAIL_PEEK_CLOSE_DELAY_MS);
  }, [clearCloseTimer, clearOpenTimer, commitOpen]);

  const scheduleOpen = useCallback(() => {
    clearCloseTimer();
    if (!optionsRef.current.enabled || openRef.current || openTimerRef.current) return;
    openTimerRef.current = setTimeout(() => {
      openTimerRef.current = null;
      if (optionsRef.current.enabled && (hoverRef.current.edge || hoverRef.current.trigger)) commitOpen(true);
    }, LIBRARY_RAIL_PEEK_OPEN_DELAY_MS);
  }, [clearCloseTimer, commitOpen]);

  const onTriggerPointerEnter = useCallback(() => {
    hoverRef.current.edge = false;
    hoverRef.current.trigger = true;
    scheduleOpen();
  }, [scheduleOpen]);

  const onTriggerPointerLeave = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      hoverRef.current.trigger = false;
      const enteredNativeLeftEdge =
        event.clientX <= LIBRARY_RAIL_PEEK_NATIVE_EDGE_MAX_X && event.clientY > 0 && event.clientY < window.innerHeight;
      if (enteredNativeLeftEdge) {
        hoverRef.current.edge = true;
        return;
      }
      hoverRef.current.edge = false;
      if (!openRef.current) clearOpenTimer();
      scheduleClose();
    },
    [clearOpenTimer, scheduleClose],
  );

  const onRailPointerEnter = useCallback(() => {
    hoverRef.current.edge = false;
    hoverRef.current.rail = true;
    clearCloseTimer();
  }, [clearCloseTimer]);

  const onRailPointerLeave = useCallback(() => {
    hoverRef.current.edge = false;
    hoverRef.current.rail = false;
    scheduleClose();
  }, [scheduleClose]);

  useEffect(() => {
    if (!enabled) {
      closeNow();
      return;
    }
    if (interactionLocked) clearCloseTimer();
    else if (openRef.current && !hoverRef.current.edge && !hoverRef.current.rail && !hoverRef.current.trigger) scheduleClose();
  }, [clearCloseTimer, closeNow, enabled, interactionLocked, scheduleClose]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeNow();
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("blur", closeNow);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("blur", closeNow);
    };
  }, [closeNow, open]);

  useEffect(
    () => () => {
      clearOpenTimer();
      clearCloseTimer();
    },
    [clearCloseTimer, clearOpenTimer],
  );

  return {
    open,
    closeNow,
    onTriggerPointerEnter,
    onTriggerPointerLeave,
    onRailPointerEnter,
    onRailPointerLeave,
  };
}
