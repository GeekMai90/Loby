import { Archive, Files, Target, Trash2 } from "lucide-react";
import clsx from "clsx";
import type { ProjectFilter } from "../lib/projectModel";

interface LibraryFilterNavProps {
  projectFilter: ProjectFilter;
  activeNoteGroupId: string;
  onProjectFilterChange: (filter: ProjectFilter) => void;
}

export function LibraryFilterNav({ projectFilter, activeNoteGroupId, onProjectFilterChange }: LibraryFilterNavProps) {
  return (
    <nav className="nav-group">
      <button
        className={clsx("nav-item", !activeNoteGroupId && projectFilter === "active" && "active")}
        onClick={() => onProjectFilterChange("active")}
      >
        <Files size={16} />
        <span>全部</span>
      </button>
      <button
        className={clsx("nav-item", !activeNoteGroupId && projectFilter === "today" && "active")}
        onClick={() => onProjectFilterChange("today")}
      >
        <Target size={16} />
        <span>今日写作</span>
      </button>
      <button
        className={clsx("nav-item", !activeNoteGroupId && projectFilter === "archived" && "active")}
        onClick={() => onProjectFilterChange("archived")}
      >
        <Archive size={16} />
        <span>已归档</span>
      </button>
      <button
        className={clsx("nav-item", !activeNoteGroupId && projectFilter === "trash" && "active")}
        onClick={() => onProjectFilterChange("trash")}
      >
        <Trash2 size={16} />
        <span>废纸篓</span>
      </button>
    </nav>
  );
}
