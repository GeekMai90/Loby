/**
 * [INPUT]: 依赖 React useRef 与主窗口各栏位的显隐状态和更新回调
 * [OUTPUT]: 对外提供 useFocusModeLayout，负责进入专注模式时收起辅助栏位并在退出时恢复原布局
 * [POS]: editor feature 的专注写作布局协调边界；只管理主编辑器栏位快照，不创建独立窗口
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
