import { FilePlus2, Search, Trash2 } from "lucide-react";
import clsx from "clsx";
import type { MouseEvent } from "react";

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
        <button className={clsx("icon-button", filterOpen && "active")} onClick={onToggleFilter} title="筛选文稿">
          <Search size={16} />
        </button>
        <button
          className={clsx("icon-button", trashMode && "danger-toolbar-button")}
          onClick={trashMode ? onClearTrash : onCreateSheet}
          title={trashMode ? "清空废纸篓" : "新建文稿"}
        >
          {trashMode ? <Trash2 size={16} /> : <FilePlus2 size={16} />}
        </button>
      </div>
    </div>
  );
}
