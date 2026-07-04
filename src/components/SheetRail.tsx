import { ArrowUpDown, Check, FilePlus2, Search } from "lucide-react";
import clsx from "clsx";
import { useState, type DragEvent, type KeyboardEvent, type MouseEvent } from "react";
import type { SheetDropTarget, WritingSheet } from "../types";

export type SheetSortMode = "manual" | "title" | "updated" | "created";
export type SheetSortDirection = "asc" | "desc";

interface SheetRailProps {
  title: string;
  search: string;
  filterOpen: boolean;
  sortMode: SheetSortMode;
  sortDirection: SheetSortDirection;
  sheets: WritingSheet[];
  activeSheetId: string;
  draggingSheetId: string;
  dropTarget: SheetDropTarget | null;
  onWindowDragStart: (event: MouseEvent<HTMLElement>) => void;
  onCreateSheet: () => void;
  onSearchChange: (search: string) => void;
  onFilterOpenChange: (open: boolean) => void;
  onSortModeChange: (mode: SheetSortMode) => void;
  onSortDirectionChange: (direction: SheetSortDirection) => void;
  onSelectSheet: (sheetId: string) => void;
  onClearSheetSelection: () => void;
  onSheetDragStart: (event: DragEvent<HTMLElement>, sheetId: string) => void;
  onSheetDragOver: (event: DragEvent<HTMLElement>, sheetId: string) => void;
  onSheetDrop: (event: DragEvent<HTMLElement>, sheetId: string) => void;
  onSheetDragEnd: () => void;
}

const SHEET_SORT_OPTIONS: Array<{ mode: SheetSortMode; label: string }> = [
  { mode: "manual", label: "手动排序" },
  { mode: "title", label: "按标题" },
  { mode: "updated", label: "按修改日期" },
  { mode: "created", label: "按创建日期" },
];

const DATE_SORT_DIRECTIONS: Array<{ direction: SheetSortDirection; label: string }> = [
  { direction: "asc", label: "从旧到新" },
  { direction: "desc", label: "从新到旧" },
];

export function SheetRail({
  title,
  search,
  filterOpen,
  sortMode,
  sortDirection,
  sheets,
  activeSheetId,
  draggingSheetId,
  dropTarget,
  onWindowDragStart,
  onCreateSheet,
  onSearchChange,
  onFilterOpenChange,
  onSortModeChange,
  onSortDirectionChange,
  onSelectSheet,
  onClearSheetSelection,
  onSheetDragStart,
  onSheetDragOver,
  onSheetDrop,
  onSheetDragEnd,
}: SheetRailProps) {
  const [sortMenuOpen, setSortMenuOpen] = useState(false);

  function toggleFilter() {
    const nextOpen = !filterOpen;
    onFilterOpenChange(nextOpen);
    if (!nextOpen) onSearchChange("");
  }

  function clearSelectionFromBlankArea(event: MouseEvent<HTMLDivElement>) {
    const target = event.target;
    if (target instanceof Element && target.closest(".sheet-row")) return;
    onClearSheetSelection();
  }

  function selectSortMode(mode: SheetSortMode) {
    onSortModeChange(mode);
    if (mode !== "updated" && mode !== "created") setSortMenuOpen(false);
  }

  function selectSortDirection(direction: SheetSortDirection) {
    onSortDirectionChange(direction);
    setSortMenuOpen(false);
  }

  return (
    <aside className="sheet-rail">
      <div className="sheet-rail-content">
        <div className="rail-toolbar sheet-local-toolbar" data-tauri-drag-region onMouseDown={onWindowDragStart}>
          <div className="rail-toolbar-actions">
            <button className={clsx("icon-button", filterOpen && "active")} onClick={toggleFilter} title="筛选文稿">
              <Search size={16} />
            </button>
            <button className="icon-button" onClick={onCreateSheet} title="新建文稿">
              <FilePlus2 size={16} />
            </button>
          </div>
        </div>

        <div className="project-heading group-heading">
          <div className="sheet-heading-row">
            <strong>{title}</strong>
            <div className="sheet-sort-control" data-no-window-drag>
              <button
                className={clsx("icon-button sheet-sort-button", sortMenuOpen && "active")}
                onClick={() => setSortMenuOpen((open) => !open)}
                title="排序"
              >
                <ArrowUpDown size={15} />
              </button>
              {sortMenuOpen && (
                <div className="sheet-sort-menu">
                  {SHEET_SORT_OPTIONS.map((option) => (
                    <button key={option.mode} onClick={() => selectSortMode(option.mode)}>
                      <span className="sort-check">{sortMode === option.mode && <Check size={14} />}</span>
                      <span>{option.label}</span>
                    </button>
                  ))}
                  {(sortMode === "updated" || sortMode === "created") && (
                    <>
                      <div className="sheet-sort-menu-separator" />
                      {DATE_SORT_DIRECTIONS.map((option) => (
                        <button key={option.direction} onClick={() => selectSortDirection(option.direction)}>
                          <span className="sort-check">{sortDirection === option.direction && <Check size={14} />}</span>
                          <span>{option.label}</span>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {filterOpen && (
          <label className="rail-search">
            <Search size={14} />
            <input value={search} placeholder="搜索当前分组文稿" onChange={(event) => onSearchChange(event.target.value)} autoFocus />
          </label>
        )}

        <div className="sheet-list sheet-list-card-list" onClick={clearSelectionFromBlankArea}>
          {sheets.map((sheet) => (
            <SheetRow
              key={sheet.id}
              sheet={sheet}
              selected={activeSheetId === sheet.id}
              dragging={draggingSheetId === sheet.id}
              dropPosition={dropTarget?.sheetId === sheet.id ? dropTarget.position : null}
              onSelectSheet={onSelectSheet}
              onDragStart={onSheetDragStart}
              onDragOver={onSheetDragOver}
              onDrop={onSheetDrop}
              onDragEnd={onSheetDragEnd}
            />
          ))}
          {sheets.length === 0 && <p className="empty-list sheet-empty-list">没有文稿</p>}
        </div>
      </div>
    </aside>
  );
}

function SheetRow({
  sheet,
  selected,
  dragging,
  dropPosition,
  onSelectSheet,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  sheet: WritingSheet;
  selected: boolean;
  dragging: boolean;
  dropPosition: SheetDropTarget["position"] | null;
  onSelectSheet: (sheetId: string) => void;
  onDragStart: (event: DragEvent<HTMLElement>, sheetId: string) => void;
  onDragOver: (event: DragEvent<HTMLElement>, sheetId: string) => void;
  onDrop: (event: DragEvent<HTMLElement>, sheetId: string) => void;
  onDragEnd: () => void;
}) {
  function selectSheetFromKeyboard(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onSelectSheet(sheet.id);
  }
  const displayTitle = getSheetDisplayTitle(sheet);
  const preview = getSheetPreview(sheet);

  return (
    <article
      role="button"
      tabIndex={0}
      className={clsx("sheet-row", selected && "selected", dragging && "dragging", dropPosition && `drop-${dropPosition}`)}
      draggable
      onClick={() => onSelectSheet(sheet.id)}
      onKeyDown={selectSheetFromKeyboard}
      onDragStart={(event) => onDragStart(event, sheet.id)}
      onDragOver={(event) => onDragOver(event, sheet.id)}
      onDrop={(event) => onDrop(event, sheet.id)}
      onDragEnd={onDragEnd}
    >
      <div className="sheet-row-main">
        <strong>{displayTitle}</strong>
        <span>{preview}</span>
      </div>
    </article>
  );
}

function getSheetDisplayTitle(sheet: WritingSheet) {
  const headingTitle = sheet.body.match(/^#\s+(.+?)\s*#*\s*$/m)?.[1]?.trim();
  return headingTitle || sheet.title || "无标题";
}

function getSheetPreview(sheet: WritingSheet) {
  return sheet.body
    .split("\n")
    .map((line) =>
      line
        .replace(/^#{1,6}\s+/, "")
        .replace(/^>\s?/, "")
        .replace(/^\s*[-*+]\s+\[[ xX]\]\s+/, "")
        .replace(/^\s*[-*+]\s+/, "")
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/\*(.*?)\*/g, "$1")
        .replace(/::([^:\n]+?)::/g, "$1")
        .replace(/`([^`]+)`/g, "$1")
        .trim(),
    )
    .filter(Boolean)
    .filter((line) => line !== getSheetDisplayTitle(sheet))
    .slice(0, 3)
    .join(" ");
}
