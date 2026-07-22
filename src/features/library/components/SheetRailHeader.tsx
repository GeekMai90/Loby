/**
 * [INPUT]: 依赖 shared 公共契约、写作库模块
 * [OUTPUT]: 对外提供 SheetRailHeader
 * [POS]: 写作库 feature 的界面组合单元，连接 写作库 状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { SheetSortDirection, SheetSortMode } from "@/shared/types";
import { SheetSortControl } from "@/features/library/components/SheetSortControl";

interface SheetRailHeaderProps {
  title: string;
  sortMode: SheetSortMode;
  sortDirection: SheetSortDirection;
  onSortModeChange: (mode: SheetSortMode) => void;
  onSortDirectionChange: (direction: SheetSortDirection) => void;
}

export function SheetRailHeader({ title, sortMode, sortDirection, onSortModeChange, onSortDirectionChange }: SheetRailHeaderProps) {
  return (
    <div className="flex flex-col gap-2 border-b border-border pb-1">
      <div className="relative z-1 flex min-h-8.5 min-w-0 items-center gap-2 overflow-visible group/sort">
        <div
          className="flex min-h-7 min-w-0 flex-auto items-center overflow-visible py-0.75 pb-1 text-[17px] leading-5.5 font-bold whitespace-nowrap"
          title={title}
        >
          {title}
        </div>
        <SheetSortControl
          sortMode={sortMode}
          sortDirection={sortDirection}
          onSortModeChange={onSortModeChange}
          onSortDirectionChange={onSortDirectionChange}
        />
      </div>
    </div>
  );
}
