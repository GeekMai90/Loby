/**
 * [INPUT]: 依赖 clsx、React 运行时、shared 公共契约、写作库模块
 * [OUTPUT]: 对外提供 SheetRail
 * [POS]: 写作库 feature 的界面组合单元，连接 写作库 状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import clsx from "clsx";
import type { MouseEvent, WheelEvent } from "react";
import type { SheetDropTarget, SheetSortDirection, SheetSortMode, WritingSheet } from "@/shared/types";
import type { SheetMoveTarget } from "@/features/library/model/projectCreation";
import type { SheetSelectionModifiers } from "@/features/library/model/sheetSelection";
import { useSheetPointerDrag } from "@/features/library/hooks/useSheetPointerDrag";
import { RailModeSwitch } from "@/shared/components/RailModeSwitch";
import { SheetDragPreview } from "@/features/library/components/SheetDragPreview";
import { SheetList } from "@/features/library/components/SheetList";
import { SheetRailHeader } from "@/features/library/components/SheetRailHeader";
import { SheetRailToolbar } from "@/features/library/components/SheetRailToolbar";

interface SheetRailProps {
  active: boolean;
  title: string;
  search: string;
  filterOpen: boolean;
  sortMode: SheetSortMode;
  sortDirection: SheetSortDirection;
  sheets: WritingSheet[];
  sheetProjectTitleById: Record<string, string>;
  activeSheetId: string;
  selectedSheetIds: string[];
  draggingSheetId: string;
  dropTarget: SheetDropTarget | null;
  canReorderSheets: boolean;
  canMoveSheets: boolean;
  onWindowDragStart: (event: MouseEvent<HTMLElement>) => void;
  onWindowToolbarDoubleClick: (event: MouseEvent<HTMLElement>) => void;
  onCreateSheet: () => void;
  onSearchChange: (search: string) => void;
  onFilterOpenChange: (open: boolean) => void;
  onSortModeChange: (mode: SheetSortMode) => void;
  onSortDirectionChange: (direction: SheetSortDirection) => void;
  onSelectSheet: (sheetId: string, modifiers: SheetSelectionModifiers) => void;
  onClearSheetSelection: () => void;
  onSheetContextMenu: (event: MouseEvent<HTMLElement>, sheetId: string) => void;
  onSheetReorderStart: (sheetId: string) => void;
  onSheetReorderPreview: (target: SheetDropTarget | null) => void;
  onSheetReorderCommit: (sourceSheetId: string, targetSheetId: string, position: SheetDropTarget["position"]) => void;
  onSheetReorderEnd: () => void;
  onSheetMoveCommit: (sheetId: string, target: SheetMoveTarget) => void;
  onSheetDragPreviewProject: (projectId: string) => void;
  onSheetDragPreviewLibrary: () => void;
  onSheetDragPreviewClear: () => void;
  trashMode?: boolean;
  onClearTrash: () => void;
  railModeSwitchExpanded: boolean;
  onRailModeSwitchExpandedChange: (expanded: boolean) => void;
  onSelectRailMode: (mode: "list" | "document") => void;
  onRailWheel: (event: WheelEvent<HTMLElement>) => void;
  onActivate: () => void;
}

export function SheetRail({
  active,
  title,
  search,
  filterOpen,
  sortMode,
  sortDirection,
  sheets,
  sheetProjectTitleById,
  activeSheetId,
  selectedSheetIds,
  draggingSheetId,
  dropTarget,
  canReorderSheets,
  canMoveSheets,
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
  onSheetMoveCommit,
  onSheetDragPreviewProject,
  onSheetDragPreviewLibrary,
  onSheetDragPreviewClear,
  trashMode = false,
  onClearTrash,
  railModeSwitchExpanded,
  onRailModeSwitchExpandedChange,
  onSelectRailMode,
  onRailWheel,
  onActivate,
}: SheetRailProps) {
  const { dragPreview, startSheetPointerDrag, suppressClickAfterDrag } = useSheetPointerDrag({
    sheets,
    sheetProjectTitleById,
    canReorderSheets,
    canMoveSheets,
    onSheetReorderStart,
    onSheetReorderPreview,
    onSheetReorderCommit,
    onSheetReorderEnd,
    onSheetMoveCommit,
    onSheetDragPreviewProject,
    onSheetDragPreviewLibrary,
    onSheetDragPreviewClear,
  });

  function toggleFilter() {
    const nextOpen = !filterOpen;
    onFilterOpenChange(nextOpen);
    if (!nextOpen) {
      onSearchChange("");
    }
  }

  return (
    <aside
      className={clsx(
        "sheet-rail select-none",
        canReorderSheets && "can-reorder-sheets",
        canMoveSheets && "can-move-sheets",
        draggingSheetId && "is-reordering",
      )}
      onWheel={onRailWheel}
      onWheelCapture={onActivate}
      onPointerDownCapture={onActivate}
      onFocusCapture={onActivate}
    >
      <div className="sheet-rail-content relative">
        <SheetRailToolbar
          filterOpen={filterOpen}
          search={search}
          trashMode={trashMode}
          onToggleFilter={toggleFilter}
          onSearchChange={onSearchChange}
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

        <SheetList
          active={active}
          sheets={sheets}
          sheetProjectTitleById={sheetProjectTitleById}
          activeSheetId={activeSheetId}
          selectedSheetIds={selectedSheetIds}
          draggingSheetId={draggingSheetId}
          dropTarget={dropTarget}
          canReorderSheets={canReorderSheets}
          canMoveSheets={canMoveSheets}
          onClearSheetSelection={onClearSheetSelection}
          onSelectSheet={onSelectSheet}
          onSheetContextMenu={onSheetContextMenu}
          onStartPointerDrag={startSheetPointerDrag}
          onSuppressClickAfterDrag={suppressClickAfterDrag}
        />
        <RailModeSwitch
          active="list"
          expanded={railModeSwitchExpanded}
          onExpandedChange={onRailModeSwitchExpandedChange}
          onSelectMode={onSelectRailMode}
        />
      </div>
      {dragPreview && <SheetDragPreview preview={dragPreview} />}
    </aside>
  );
}
