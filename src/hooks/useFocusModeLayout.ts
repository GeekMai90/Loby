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
