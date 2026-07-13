import type { SheetSortDirection, SheetSortMode } from "../types";
import { SheetSortControl } from "./SheetSortControl";

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
