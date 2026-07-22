/**
 * [INPUT]: 依赖 shadcn/ui 基础控件、lucide-react、React 运行时、shared 公共契约
 * [OUTPUT]: 对外提供 SheetSortControl
 * [POS]: 写作库 feature 的界面组合单元，连接 写作库 状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowUpDown } from "lucide-react";
import { useState } from "react";
import type { SheetSortDirection, SheetSortMode } from "@/shared/types";

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
  return (
    <div className="relative shrink-0" data-no-window-drag>
      <DropdownMenu open={sortMenuOpen} onOpenChange={setSortMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="pointer-events-none opacity-0 transition-opacity group-hover/sort:pointer-events-auto group-hover/sort:opacity-100 group-focus-within/sort:pointer-events-auto group-focus-within/sort:opacity-100 data-[state=open]:pointer-events-auto data-[state=open]:opacity-100"
            title="排序"
          >
            <ArrowUpDown size={15} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={4} className="w-36">
          <DropdownMenuRadioGroup value={sortMode} onValueChange={(mode) => onSortModeChange(mode as SheetSortMode)}>
            {SHEET_SORT_OPTIONS.map((option) => (
              <DropdownMenuRadioItem
                key={option.mode}
                value={option.mode}
                onSelect={(event) => (option.mode === "updated" || option.mode === "created") && event.preventDefault()}
              >
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          {(sortMode === "updated" || sortMode === "created") && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup
                value={sortDirection}
                onValueChange={(direction) => onSortDirectionChange(direction as SheetSortDirection)}
              >
                {DATE_SORT_DIRECTIONS.map((option) => (
                  <DropdownMenuRadioItem key={option.direction} value={option.direction}>
                    {option.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
