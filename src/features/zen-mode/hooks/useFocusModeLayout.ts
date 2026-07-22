/**
 * [INPUT]: 依赖 React 运行时
 * [OUTPUT]: 对外提供 useFocusModeLayout
 * [POS]: 禅模式 feature 的React 协调边界，封装 禅模式 状态、副作用与用户动作
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useRef } from "react";

interface FocusLayoutSnapshot {
  libraryRailOpen: boolean;
  sheetRailOpen: boolean;
  inspectorOpen: boolean;
}

interface UseFocusModeLayoutOptions extends FocusLayoutSnapshot {
  focusMode: boolean;
  onFocusModeChange: (enabled: boolean) => void;
  onLibraryRailOpenChange: (open: boolean) => void;
  onSheetRailOpenChange: (open: boolean) => void;
  onInspectorOpenChange: (open: boolean) => void;
  onRailModeSwitchExpandedChange: (expanded: boolean) => void;
}

export function useFocusModeLayout({
  focusMode,
  libraryRailOpen,
  sheetRailOpen,
  inspectorOpen,
  onFocusModeChange,
  onLibraryRailOpenChange,
  onSheetRailOpenChange,
  onInspectorOpenChange,
  onRailModeSwitchExpandedChange,
}: UseFocusModeLayoutOptions) {
  const previousLayoutRef = useRef<FocusLayoutSnapshot | null>(null);

  function setFocusModeEnabled(enabled: boolean) {
    if (enabled === focusMode) return;

    if (enabled) {
      previousLayoutRef.current = { libraryRailOpen, sheetRailOpen, inspectorOpen };
      onLibraryRailOpenChange(false);
      onSheetRailOpenChange(false);
      onInspectorOpenChange(false);
      onRailModeSwitchExpandedChange(false);
      onFocusModeChange(true);
      return;
    }

    const previousLayout = previousLayoutRef.current ?? { libraryRailOpen: true, sheetRailOpen: true, inspectorOpen: true };
    previousLayoutRef.current = null;
    onLibraryRailOpenChange(previousLayout.libraryRailOpen);
    onSheetRailOpenChange(previousLayout.sheetRailOpen);
    onInspectorOpenChange(previousLayout.inspectorOpen);
    onFocusModeChange(false);
  }

  function toggleFocusMode() {
    setFocusModeEnabled(!focusMode);
  }

  return {
    setFocusModeEnabled,
    toggleFocusMode,
  };
}
