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
    <div className="project-heading group-heading">
      <div className="sheet-heading-row">
        <div className="sheet-heading-title" title={title}>
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
