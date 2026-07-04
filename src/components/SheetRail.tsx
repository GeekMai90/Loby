import { FilePlus2, Search } from "lucide-react";
import clsx from "clsx";
import type { DragEvent, KeyboardEvent, MouseEvent } from "react";
import type { SheetDropTarget, WritingSheet } from "../types";
import { countWords } from "../lib/text";

interface SheetRailProps {
  title: string;
  search: string;
  sheets: WritingSheet[];
  activeSheetId: string;
  draggingSheetId: string;
  dropTarget: SheetDropTarget | null;
  onWindowDragStart: (event: MouseEvent<HTMLElement>) => void;
  onCreateSheet: () => void;
  onSearchChange: (search: string) => void;
  onSelectSheet: (sheetId: string) => void;
  onSheetDragStart: (event: DragEvent<HTMLElement>, sheetId: string) => void;
  onSheetDragOver: (event: DragEvent<HTMLElement>, sheetId: string) => void;
  onSheetDrop: (event: DragEvent<HTMLElement>, sheetId: string) => void;
  onSheetDragEnd: () => void;
}

export function SheetRail({
  title,
  search,
  sheets,
  activeSheetId,
  draggingSheetId,
  dropTarget,
  onWindowDragStart,
  onCreateSheet,
  onSearchChange,
  onSelectSheet,
  onSheetDragStart,
  onSheetDragOver,
  onSheetDrop,
  onSheetDragEnd,
}: SheetRailProps) {
  return (
    <aside className="sheet-rail">
      <div className="sheet-rail-content">
        <div className="rail-toolbar sheet-local-toolbar" data-tauri-drag-region onMouseDown={onWindowDragStart}>
          <div className="rail-toolbar-actions">
            <button className="icon-button" onClick={onCreateSheet} title="新建文稿">
              <FilePlus2 size={16} />
            </button>
          </div>
        </div>

        <div className="project-heading group-heading">
          <strong>{title}</strong>
        </div>

        <label className="rail-search">
          <Search size={14} />
          <input value={search} placeholder="搜索卡片、正文、摘要" onChange={(event) => onSearchChange(event.target.value)} />
        </label>

        <div className="sheet-list sheet-list-card-list">
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
          {sheets.length === 0 && <p className="empty-list">没有匹配的文稿</p>}
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
        <strong>{sheet.title}</strong>
        <span>{sheet.summary}</span>
      </div>
      <div className="sheet-row-meta">
        <small>{sheet.status}</small>
        <small>
          {countWords(sheet.body)} / {sheet.targetWords}
        </small>
      </div>
    </article>
  );
}
