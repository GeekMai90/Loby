import { Search } from "lucide-react";
import clsx from "clsx";
import { useRef, type MouseEvent, type PointerEvent as ReactPointerEvent, type WheelEvent } from "react";
import type { SheetDropTarget, SheetSortDirection, SheetSortMode, WritingSheet } from "../types";
import { RailModeSwitch } from "./RailModeSwitch";
import { SheetList } from "./SheetList";
import { SheetRailHeader } from "./SheetRailHeader";
import { SheetRailToolbar } from "./SheetRailToolbar";

interface SheetPointerDragSession {
  sheetId: string;
  startX: number;
  startY: number;
  active: boolean;
}

interface SheetRailProps {
  title: string;
  search: string;
  filterOpen: boolean;
  sortMode: SheetSortMode;
  sortDirection: SheetSortDirection;
  sheets: WritingSheet[];
  sheetProjectTitleById: Record<string, string>;
  activeSheetId: string;
  draggingSheetId: string;
  dropTarget: SheetDropTarget | null;
  canReorderSheets: boolean;
  onWindowDragStart: (event: MouseEvent<HTMLElement>) => void;
  onWindowToolbarDoubleClick: (event: MouseEvent<HTMLElement>) => void;
  onCreateSheet: () => void;
  onSearchChange: (search: string) => void;
  onFilterOpenChange: (open: boolean) => void;
  onSortModeChange: (mode: SheetSortMode) => void;
  onSortDirectionChange: (direction: SheetSortDirection) => void;
  onSelectSheet: (sheetId: string) => void;
  onClearSheetSelection: () => void;
  onSheetContextMenu: (event: MouseEvent<HTMLElement>, sheetId: string) => void;
  onSheetReorderStart: (sheetId: string) => void;
  onSheetReorderPreview: (target: SheetDropTarget | null) => void;
  onSheetReorderCommit: (sourceSheetId: string, targetSheetId: string, position: SheetDropTarget["position"]) => void;
  onSheetReorderEnd: () => void;
  trashMode?: boolean;
  onClearTrash: () => void;
  railModeSwitchExpanded: boolean;
  onRailModeSwitchExpandedChange: (expanded: boolean) => void;
  onSelectRailMode: (mode: "list" | "document") => void;
  onRailWheel: (event: WheelEvent<HTMLElement>) => void;
}

export function SheetRail({
  title,
  search,
  filterOpen,
  sortMode,
  sortDirection,
  sheets,
  sheetProjectTitleById,
  activeSheetId,
  draggingSheetId,
  dropTarget,
  canReorderSheets,
  onWindowDragStart,
  onWindowToolbarDoubleClick,
  onCreateSheet,
  onSearchChange,
  onFilterOpenChange,
  onSortModeChange,
  onSortDirectionChange,
  onSelectSheet,
  onClearSheetSelection,
  onSheetContextMenu,
  onSheetReorderStart,
  onSheetReorderPreview,
  onSheetReorderCommit,
  onSheetReorderEnd,
  trashMode = false,
  onClearTrash,
  railModeSwitchExpanded,
  onRailModeSwitchExpandedChange,
  onSelectRailMode,
  onRailWheel,
}: SheetRailProps) {
  const pointerDragRef = useRef<SheetPointerDragSession | null>(null);
  const dropTargetRef = useRef<SheetDropTarget | null>(null);
  const suppressNextClickRef = useRef(false);

  function toggleFilter() {
    const nextOpen = !filterOpen;
    onFilterOpenChange(nextOpen);
    if (!nextOpen) onSearchChange("");
  }

  function startSheetPointerDrag(sheetId: string, event: ReactPointerEvent<HTMLElement>) {
    if (!canReorderSheets || event.button !== 0) return;
    pointerDragRef.current = {
      sheetId,
      startX: event.clientX,
      startY: event.clientY,
      active: false,
    };
    dropTargetRef.current = null;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function updateSheetPointerDrag(event: ReactPointerEvent<HTMLElement>) {
    const session = pointerDragRef.current;
    if (!session) return;

    const distance = Math.hypot(event.clientX - session.startX, event.clientY - session.startY);
    if (!session.active && distance < 4) return;
    if (!session.active) {
      session.active = true;
      onSheetReorderStart(session.sheetId);
    }
    event.preventDefault();

    const target = document.elementFromPoint(event.clientX, event.clientY);
    const targetRow = target instanceof Element ? target.closest<HTMLElement>(".sheet-row[data-sheet-id]") : null;
    const targetSheetId = targetRow?.dataset.sheetId;
    if (!targetRow || !targetSheetId || targetSheetId === session.sheetId) {
      dropTargetRef.current = null;
      onSheetReorderPreview(null);
      return;
    }

    const bounds = targetRow.getBoundingClientRect();
    const position: SheetDropTarget["position"] = event.clientY < bounds.top + bounds.height / 2 ? "before" : "after";
    const nextTarget = { sheetId: targetSheetId, position };
    dropTargetRef.current = nextTarget;
    onSheetReorderPreview(nextTarget);
  }

  function finishSheetPointerDrag(event: ReactPointerEvent<HTMLElement>) {
    const session = pointerDragRef.current;
    const finalDropTarget = dropTargetRef.current;
    event.currentTarget.releasePointerCapture?.(event.pointerId);

    if (session?.active) {
      suppressNextClickRef.current = true;
      event.preventDefault();
      event.stopPropagation();
    }

    if (session?.active && finalDropTarget) {
      onSheetReorderCommit(session.sheetId, finalDropTarget.sheetId, finalDropTarget.position);
    } else {
      onSheetReorderEnd();
    }

    pointerDragRef.current = null;
    dropTargetRef.current = null;
  }

  function cancelSheetPointerDrag() {
    pointerDragRef.current = null;
    dropTargetRef.current = null;
    onSheetReorderEnd();
  }

  function suppressClickAfterDrag(event: MouseEvent<HTMLElement>) {
    if (!suppressNextClickRef.current) return false;
    suppressNextClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
    return true;
  }

  return (
    <aside
      className={clsx("sheet-rail", canReorderSheets && "can-reorder-sheets", draggingSheetId && "is-reordering")}
      onWheel={onRailWheel}
    >
      <div className="sheet-rail-content">
        <SheetRailToolbar
          filterOpen={filterOpen}
          trashMode={trashMode}
          onToggleFilter={toggleFilter}
          onCreateSheet={onCreateSheet}
          onClearTrash={onClearTrash}
          onWindowDragStart={onWindowDragStart}
          onWindowToolbarDoubleClick={onWindowToolbarDoubleClick}
        />

        <SheetRailHeader
          title={title}
          sortMode={sortMode}
          sortDirection={sortDirection}
          onSortModeChange={onSortModeChange}
          onSortDirectionChange={onSortDirectionChange}
        />

        {filterOpen && (
          <label className="rail-search">
            <Search size={14} />
            <input value={search} placeholder="搜索当前分组文稿" onChange={(event) => onSearchChange(event.target.value)} autoFocus />
          </label>
        )}

        <SheetList
          sheets={sheets}
          sheetProjectTitleById={sheetProjectTitleById}
          activeSheetId={activeSheetId}
          draggingSheetId={draggingSheetId}
          dropTarget={dropTarget}
          canReorderSheets={canReorderSheets}
          onClearSheetSelection={onClearSheetSelection}
          onSelectSheet={onSelectSheet}
          onSheetContextMenu={onSheetContextMenu}
          onStartPointerDrag={startSheetPointerDrag}
          onUpdatePointerDrag={updateSheetPointerDrag}
          onFinishPointerDrag={finishSheetPointerDrag}
          onCancelPointerDrag={cancelSheetPointerDrag}
          onSuppressClickAfterDrag={suppressClickAfterDrag}
        />
        <RailModeSwitch
          active="list"
          expanded={railModeSwitchExpanded}
          onExpandedChange={onRailModeSwitchExpandedChange}
          onSelectMode={onSelectRailMode}
        />
      </div>
    </aside>
  );
}
