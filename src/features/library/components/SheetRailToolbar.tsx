/**
 * [INPUT]: 依赖 shadcn/ui 基础控件、clsx、lucide-react、React 运行时、shared 公共契约
 * [OUTPUT]: 对外提供 SheetRailToolbar
 * [POS]: 写作库 feature 的界面组合单元，连接 写作库 状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import clsx from "clsx";
import { CircleX, FilePlus2, Search, Trash2 } from "lucide-react";
import type { MouseEvent } from "react";
import { APP_SHORTCUTS, appShortcutAriaKeys, appShortcutTitle } from "@/shared/lib/keyboardShortcuts";

interface SheetRailToolbarProps {
  filterOpen: boolean;
  search: string;
  trashMode: boolean;
  onToggleFilter: () => void;
  onSearchChange: (search: string) => void;
  onCreateSheet: () => void;
  onClearTrash: () => void;
  onWindowDragStart: (event: MouseEvent<HTMLElement>) => void;
  onWindowToolbarDoubleClick: (event: MouseEvent<HTMLElement>) => void;
}

export function SheetRailToolbar({
  filterOpen,
  search,
  trashMode,
  onToggleFilter,
  onSearchChange,
  onCreateSheet,
  onClearTrash,
  onWindowDragStart,
  onWindowToolbarDoubleClick,
}: SheetRailToolbarProps) {
  return (
    <div
      className={clsx("rail-toolbar sheet-local-toolbar", filterOpen && "is-searching")}
      data-tauri-drag-region
      onMouseDown={onWindowDragStart}
      onDoubleClick={onWindowToolbarDoubleClick}
    >
      {filterOpen ? (
        <div
          className="sheet-toolbar-search relative block w-full rounded-full ring-4 ring-primary/10 transition-shadow focus-within:ring-primary/20 [-webkit-app-region:no-drag]"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <Search className="pointer-events-none absolute top-1/2 left-2.5 z-1 -translate-y-1/2 text-primary" size={15} />
          <Input
            autoFocus
            aria-label="搜索当前分组文稿"
            className="h-8 rounded-full border-primary/45 bg-background/90 pr-8 pl-8 shadow-sm focus-visible:border-primary/65 focus-visible:ring-0"
            placeholder="搜索"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") onToggleFilter();
            }}
          />
          <button
            type="button"
            className="absolute top-1/2 right-1 grid size-6 -translate-y-1/2 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 text-muted-foreground outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/25"
            title="关闭搜索"
            aria-label="关闭搜索"
            onClick={onToggleFilter}
          >
            <CircleX size={14} />
          </button>
        </div>
      ) : (
        <div className="rail-toolbar-actions">
          <Button
            variant={trashMode ? "destructive" : "ghost"}
            size="icon-sm"
            onClick={trashMode ? onClearTrash : onCreateSheet}
            title={trashMode ? "清空废纸篓" : appShortcutTitle("newSheet")}
            aria-keyshortcuts={trashMode ? undefined : appShortcutAriaKeys(APP_SHORTCUTS.newSheet)}
          >
            {trashMode ? <Trash2 className="size-3.5" /> : <FilePlus2 className="size-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onToggleFilter}
            title={appShortcutTitle("searchSheets", "搜索文稿")}
            aria-keyshortcuts={appShortcutAriaKeys(APP_SHORTCUTS.searchSheets)}
          >
            <Search className="size-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
