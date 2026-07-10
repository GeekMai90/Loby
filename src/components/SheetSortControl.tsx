import { ArrowUpDown, Check } from "lucide-react";
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import type { SheetSortDirection, SheetSortMode } from "../types";

interface SheetSortControlProps {
  sortMode: SheetSortMode;
  sortDirection: SheetSortDirection;
  onSortModeChange: (mode: SheetSortMode) => void;
  onSortDirectionChange: (direction: SheetSortDirection) => void;
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

export function SheetSortControl({ sortMode, sortDirection, onSortModeChange, onSortDirectionChange }: SheetSortControlProps) {
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const sortControlRef = useRef<HTMLDivElement | null>(null);

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

  function selectSortMode(mode: SheetSortMode) {
    onSortModeChange(mode);
    if (mode !== "updated" && mode !== "created") setSortMenuOpen(false);
  }

  function selectSortDirection(direction: SheetSortDirection) {
    onSortDirectionChange(direction);
    setSortMenuOpen(false);
  }

  return (
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
            <button key={option.mode} className={clsx(sortMode === option.mode && "selected")} onClick={() => selectSortMode(option.mode)}>
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
  );
}
