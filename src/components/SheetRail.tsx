import { ArrowUpDown, Check, FilePlus2, Search, Trash2 } from "lucide-react";
import clsx from "clsx";
import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import type { SheetDropTarget, SheetSortDirection, SheetSortMode, WritingSheet } from "../types";

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
  sheetProjectTitleById,
  activeSheetId,
  draggingSheetId,
  dropTarget,
  canReorderSheets,
  onWindowDragStart,
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
}: SheetRailProps) {
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const sortControlRef = useRef<HTMLDivElement | null>(null);
  const pointerDragRef = useRef<SheetPointerDragSession | null>(null);
  const dropTargetRef = useRef<SheetDropTarget | null>(null);
  const suppressNextClickRef = useRef(false);

  useEffect(() => {
    if (!sortMenuOpen) return;

    function closeOnOutsidePointer(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Node && sortControlRef.current?.contains(target)) return;
      setSortMenuOpen(false);
    }

    function closeOnContextMenu(event: globalThis.MouseEvent) {
      const target = event.target;
      if (target instanceof Node && sortControlRef.current?.contains(target)) return;
      setSortMenuOpen(false);
    }

    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") setSortMenuOpen(false);
    }

    function closeMenu() {
      setSortMenuOpen(false);
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer, true);
    document.addEventListener("contextmenu", closeOnContextMenu, true);
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", closeMenu);
    window.addEventListener("blur", closeMenu);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer, true);
      document.removeEventListener("contextmenu", closeOnContextMenu, true);
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", closeMenu);
      window.removeEventListener("blur", closeMenu);
    };
  }, [sortMenuOpen]);

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

  function selectSortMode(mode: SheetSortMode) {
    onSortModeChange(mode);
    if (mode !== "updated" && mode !== "created") setSortMenuOpen(false);
  }

  function selectSortDirection(direction: SheetSortDirection) {
    onSortDirectionChange(direction);
    setSortMenuOpen(false);
  }

  return (
    <aside className={clsx("sheet-rail", canReorderSheets && "can-reorder-sheets", draggingSheetId && "is-reordering")}>
      <div className="sheet-rail-content">
        <div className="rail-toolbar sheet-local-toolbar" data-tauri-drag-region onMouseDown={onWindowDragStart}>
          <div className="rail-toolbar-actions">
            <button className={clsx("icon-button", filterOpen && "active")} onClick={toggleFilter} title="筛选文稿">
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

        <div className="project-heading group-heading">
          <div className="sheet-heading-row">
            <div className="sheet-heading-title" title={title}>
              {title}
            </div>
            <div className="sheet-sort-control" data-no-window-drag ref={sortControlRef}>
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
                    <button
                      key={option.mode}
                      className={clsx(sortMode === option.mode && "selected")}
                      onClick={() => selectSortMode(option.mode)}
                    >
                      <span className="sort-check">{sortMode === option.mode && <Check size={14} />}</span>
                      <span>{option.label}</span>
                    </button>
                  ))}
                  {(sortMode === "updated" || sortMode === "created") && (
                    <>
                      <div className="sheet-sort-menu-separator" />
                      {DATE_SORT_DIRECTIONS.map((option) => (
                        <button
                          key={option.direction}
                          className={clsx(sortDirection === option.direction && "selected")}
                          onClick={() => selectSortDirection(option.direction)}
                        >
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
              projectTitle={sheetProjectTitleById[sheet.id]}
              selected={activeSheetId === sheet.id}
              dragging={draggingSheetId === sheet.id}
              dropPosition={dropTarget?.sheetId === sheet.id ? dropTarget.position : null}
              reorderable={canReorderSheets}
              onSelectSheet={onSelectSheet}
              onContextMenu={onSheetContextMenu}
              onStartPointerDrag={startSheetPointerDrag}
              onUpdatePointerDrag={updateSheetPointerDrag}
              onFinishPointerDrag={finishSheetPointerDrag}
              onCancelPointerDrag={cancelSheetPointerDrag}
              onSuppressClickAfterDrag={suppressClickAfterDrag}
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
  projectTitle,
  selected,
  dragging,
  dropPosition,
  reorderable,
  onSelectSheet,
  onContextMenu,
  onStartPointerDrag,
  onUpdatePointerDrag,
  onFinishPointerDrag,
  onCancelPointerDrag,
  onSuppressClickAfterDrag,
}: {
  sheet: WritingSheet;
  projectTitle?: string;
  selected: boolean;
  dragging: boolean;
  dropPosition: SheetDropTarget["position"] | null;
  reorderable: boolean;
  onSelectSheet: (sheetId: string) => void;
  onContextMenu: (event: MouseEvent<HTMLElement>, sheetId: string) => void;
  onStartPointerDrag: (sheetId: string, event: ReactPointerEvent<HTMLElement>) => void;
  onUpdatePointerDrag: (event: ReactPointerEvent<HTMLElement>) => void;
  onFinishPointerDrag: (event: ReactPointerEvent<HTMLElement>) => void;
  onCancelPointerDrag: () => void;
  onSuppressClickAfterDrag: (event: MouseEvent<HTMLElement>) => boolean;
}) {
  function selectSheetFromKeyboard(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onSelectSheet(sheet.id);
  }
  const displayTitle = getSheetDisplayTitle(sheet);
  const preview = getSheetPreview(sheet);
  const isBlank = isBlankSheet(sheet);
  const metaText = getSheetMetaText(sheet, projectTitle);

  return (
    <article
      role="button"
      tabIndex={0}
      className={clsx("sheet-row", isBlank && "blank", selected && "selected", dragging && "dragging", dropPosition && `drop-${dropPosition}`)}
      data-sheet-id={sheet.id}
      data-sheet-reorderable={reorderable ? "true" : undefined}
      onClick={(event) => {
        if (onSuppressClickAfterDrag(event)) return;
        onSelectSheet(sheet.id);
      }}
      onContextMenu={(event) => onContextMenu(event, sheet.id)}
      onKeyDown={selectSheetFromKeyboard}
      onPointerDown={(event) => onStartPointerDrag(sheet.id, event)}
      onPointerMove={onUpdatePointerDrag}
      onPointerUp={onFinishPointerDrag}
      onPointerCancel={onCancelPointerDrag}
    >
      <small className="sheet-row-time">{metaText}</small>
      {isBlank ? (
        <div className="sheet-row-blank">空白文稿</div>
      ) : (
        <div className="sheet-row-main">
          <strong>{displayTitle}</strong>
          <span>{preview}</span>
        </div>
      )}
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

function isBlankSheet(sheet: WritingSheet) {
  return !sheet.body.trim() && !sheet.summary.trim();
}

function getSheetMetaText(sheet: WritingSheet, projectTitle?: string) {
  const timeText = formatSheetTime(sheet.updatedAt || sheet.createdAt || deriveTimeFromSheetId(sheet.id));
  return projectTitle ? `${timeText} · ${projectTitle}` : timeText;
}

function deriveTimeFromSheetId(sheetId: string) {
  const match = sheetId.match(/(?:sheet|import)-(\d{10,})/);
  if (!match) return "";
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return "";
  const timestamp = value > 1_000_000_000_000 ? value : value * 1000;
  return new Date(timestamp).toISOString();
}

function formatSheetTime(value: string) {
  const date = parseSheetDate(value);
  if (!date) return "未知时间";
  const now = new Date();
  const dateKey = toDateKey(date);
  const todayKey = toDateKey(now);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const time = new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  if (dateKey === todayKey) return `今天 ${time}`;
  if (dateKey === toDateKey(yesterday)) return `昨天 ${time}`;
  if (date.getFullYear() === now.getFullYear()) {
    return `${date.getMonth() + 1}月${date.getDate()}日 ${time}`;
  }
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${time}`;
}

function parseSheetDate(value: string) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day, 0, 0);
  }
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : new Date(timestamp);
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}
