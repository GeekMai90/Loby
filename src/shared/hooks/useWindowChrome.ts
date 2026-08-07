/**
 * [INPUT]: 依赖 Tauri API、React 运行时
 * [OUTPUT]: 对外提供 useWindowChrome
 * [POS]: shared 层的跨功能复用的 React 与平台行为，不持有具体业务状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";

interface UseWindowChromeOptions {
  inspectorWidth: number;
  onInspectorWidthChange: (width: number) => void;
  onInspectorOpenChange: (updater: (open: boolean) => boolean) => void;
}

export function useWindowChrome({ inspectorWidth, onInspectorWidthChange, onInspectorOpenChange }: UseWindowChromeOptions) {
  const [inspectorSnap, setInspectorSnap] = useState(false);
  const inspectorSnapTimerRef = useRef<number | null>(null);
  const doubleClickHandledAtRef = useRef<number | null>(null);
  const appWindow = useMemo(() => (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window ? getCurrentWindow() : null), []);

  function beginInspectorResize(event: MouseEvent<HTMLDivElement>) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = inspectorWidth;

    function handleMouseMove(moveEvent: globalThis.MouseEvent) {
      const delta = moveEvent.clientX - startX;
      onInspectorWidthChange(Math.min(520, Math.max(360, Math.round(startWidth - delta))));
    }

    function handleMouseUp() {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.classList.remove("resizing-inspector");
    }

    document.body.classList.add("resizing-inspector");
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }

  function toggleInspectorPanel() {
    if (inspectorSnapTimerRef.current !== null) {
      window.clearTimeout(inspectorSnapTimerRef.current);
    }

    setInspectorSnap(true);
    onInspectorOpenChange((value) => !value);
    inspectorSnapTimerRef.current = window.setTimeout(() => {
      setInspectorSnap(false);
      inspectorSnapTimerRef.current = null;
    }, 280);
  }

  useEffect(() => {
    return () => {
      if (inspectorSnapTimerRef.current !== null) {
        window.clearTimeout(inspectorSnapTimerRef.current);
      }
    };
  }, []);

  function startWindowDrag(event: MouseEvent<HTMLElement>) {
    if (!appWindow || event.button !== 0) return;
    if (isWindowToolbarInteractiveTarget(event.target)) return;

    // 原生 startDragging 可能吞掉后续 dblclick；第二次按下直接完成最大化切换。
    if (event.detail === 2) {
      doubleClickHandledAtRef.current = Date.now();
      event.preventDefault();
      event.stopPropagation();
      void appWindow.toggleMaximize();
      return;
    }
    if (event.detail > 2) return;

    void appWindow.startDragging();
  }

  // 顶栏采用显式拖拽/双击处理；不要再给同一元素加 data-tauri-drag-region。
  // Tauri 在 macOS 会为该属性的同一次双击再执行一次 maximize，导致窗口切换两次。
  function handleWindowToolbarDoubleClick(event: MouseEvent<HTMLElement>) {
    if (!appWindow || event.button !== 0) return;
    if (isWindowToolbarInteractiveTarget(event.target)) return;

    const handledAt = doubleClickHandledAtRef.current;
    if (handledAt !== null) {
      doubleClickHandledAtRef.current = null;
      if (Date.now() - handledAt < 500) return;
    }

    event.preventDefault();
    event.stopPropagation();
    void appWindow.toggleMaximize();
  }

  return {
    appWindow,
    inspectorSnap,
    beginInspectorResize,
    toggleInspectorPanel,
    startWindowDrag,
    handleWindowToolbarDoubleClick,
  };
}

function isWindowToolbarInteractiveTarget(target: EventTarget | null) {
  return target instanceof Element && target.closest("button, input, textarea, select, a, [data-no-window-drag]");
}
