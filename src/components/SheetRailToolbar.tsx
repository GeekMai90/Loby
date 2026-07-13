import { FilePlus2, Search, Trash2 } from "lucide-react";
import type { MouseEvent } from "react";
import { APP_SHORTCUTS, appShortcutAriaKeys, appShortcutTitle } from "../lib/keyboardShortcuts";
import { LiquidGlassButton } from "./LiquidGlassButton";

interface SheetRailToolbarProps {
  filterOpen: boolean;
  trashMode: boolean;
  onToggleFilter: () => void;
  onCreateSheet: () => void;
  onClearTrash: () => void;
  onWindowDragStart: (event: MouseEvent<HTMLElement>) => void;
  onWindowToolbarDoubleClick: (event: MouseEvent<HTMLElement>) => void;
}

export function SheetRailToolbar({
  filterOpen,
  trashMode,
  onToggleFilter,
  onCreateSheet,
  onClearTrash,
  onWindowDragStart,
  onWindowToolbarDoubleClick,
}: SheetRailToolbarProps) {
  return (
    <div
      className="rail-toolbar sheet-local-toolbar"
      data-tauri-drag-region
      onMouseDown={onWindowDragStart}
      onDoubleClick={onWindowToolbarDoubleClick}
    >
      <div className="rail-toolbar-actions">
        <LiquidGlassButton
          active={filterOpen}
          onClick={onToggleFilter}
          title={appShortcutTitle("searchSheets", "搜索与筛选文稿")}
          aria-keyshortcuts={appShortcutAriaKeys(APP_SHORTCUTS.searchSheets)}
        >
          <Search size={17} />
        </LiquidGlassButton>
        <LiquidGlassButton
          tone={trashMode ? "danger" : "default"}
          active={trashMode}
          onClick={trashMode ? onClearTrash : onCreateSheet}
          title={trashMode ? "清空废纸篓" : appShortcutTitle("newSheet")}
          aria-keyshortcuts={trashMode ? undefined : appShortcutAriaKeys(APP_SHORTCUTS.newSheet)}
        >
          {trashMode ? <Trash2 size={17} /> : <FilePlus2 size={17} />}
        </LiquidGlassButton>
      </div>
    </div>
  );
}
