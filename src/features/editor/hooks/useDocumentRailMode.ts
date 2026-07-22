/**
 * [INPUT]: 依赖 React 运行时
 * [OUTPUT]: 对外提供 useDocumentRailMode
 * [POS]: 编辑器 feature 的React 协调边界，封装 编辑器 状态、副作用与用户动作
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useRef, useState, type WheelEvent } from "react";

const RAIL_SWIPE_MIN_DELTA = 38;
const RAIL_SWIPE_AXIS_RATIO = 1.25;
const RAIL_SWIPE_THROTTLE_MS = 520;

type RailMode = "list" | "document";

interface UseDocumentRailModeOptions {
  hasActiveSheet: boolean;
}

export function useDocumentRailMode({ hasActiveSheet }: UseDocumentRailModeOptions) {
  const [documentFunctionRailOpen, setDocumentFunctionRailOpen] = useState(false);
  const [railModeSwitchExpanded, setRailModeSwitchExpanded] = useState(false);
  const railSwipeLastAtRef = useRef(0);

  function showSheetListRail() {
    setDocumentFunctionRailOpen(false);
    setRailModeSwitchExpanded(false);
  }

  function selectRailMode(mode: RailMode) {
    if (mode === "document" && !hasActiveSheet) return;
    setDocumentFunctionRailOpen(mode === "document");
  }

  function handleRailWheel(event: WheelEvent<HTMLElement>) {
    const deltaX = event.deltaX;
    const deltaY = event.deltaY;
    if (Math.abs(deltaX) < RAIL_SWIPE_MIN_DELTA || Math.abs(deltaX) < Math.abs(deltaY) * RAIL_SWIPE_AXIS_RATIO) return;

    const targetMode: RailMode = deltaX > 0 ? "document" : "list";
    const currentMode: RailMode = documentFunctionRailOpen ? "document" : "list";
    if (targetMode === currentMode) return;
    if (targetMode === "document" && !hasActiveSheet) return;

    event.preventDefault();
    const now = Date.now();
    if (now - railSwipeLastAtRef.current < RAIL_SWIPE_THROTTLE_MS) return;
    railSwipeLastAtRef.current = now;
    setRailModeSwitchExpanded(false);
    setDocumentFunctionRailOpen(targetMode === "document");
  }

  return {
    documentFunctionRailOpen,
    railModeSwitchExpanded,
    setRailModeSwitchExpanded,
    showSheetListRail,
    selectRailMode,
    handleRailWheel,
  };
}
