import { Archive, Clock9, Trash2, WalletCards } from "lucide-react";
import type { ProjectFilter } from "../lib/projectModel";
import { NavigationItem } from "./NavigationItem";

interface LibraryFilterNavProps {
  active: boolean;
  projectFilter: ProjectFilter;
  activeNoteGroupId: string;
  onProjectFilterChange: (filter: ProjectFilter) => void;
}

export function LibraryFilterNav({ active, projectFilter, activeNoteGroupId, onProjectFilterChange }: LibraryFilterNavProps) {
  return (
    <nav className="relative z-1 flex flex-col gap-1">
      <NavigationItem
        selected={!activeNoteGroupId && projectFilter === "active"}
        active={active}
        onClick={() => onProjectFilterChange("active")}
      >
        <WalletCards size={16} />
        <span>全部</span>
      </NavigationItem>
      <NavigationItem
        selected={!activeNoteGroupId && projectFilter === "recent"}
        active={active}
        onClick={() => onProjectFilterChange("recent")}
      >
        <Clock9 size={16} />
        <span>最近 7 天</span>
      </NavigationItem>
      <NavigationItem
        selected={!activeNoteGroupId && projectFilter === "archived"}
        active={active}
        onClick={() => onProjectFilterChange("archived")}
      >
        <Archive size={16} />
        <span>已归档</span>
      </NavigationItem>
      <NavigationItem
        selected={!activeNoteGroupId && projectFilter === "trash"}
        active={active}
        onClick={() => onProjectFilterChange("trash")}
      >
        <Trash2 size={16} />
        <span>废纸篓</span>
      </NavigationItem>
    </nav>
  );
}
