/**
 * [INPUT]: 依赖 lucide-react、写作库模块、shared 公共契约与 Vite 开发环境标记
 * [OUTPUT]: 对外提供 LibraryFilterNav
 * [POS]: 写作库的一级导航列表；开发态在废纸篓后追加设计系统入口
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Archive, Clock9, Inbox, Palette, Trash2, WalletCards } from "lucide-react";
import { INBOX_PROJECT_ID } from "@/features/library/model/projectModel";
import type { ProjectFilter } from "@/features/library/model/projectModel";
import { NavigationItem } from "@/shared/components/NavigationItem";

interface LibraryFilterNavProps {
  active: boolean;
  projectFilter: ProjectFilter;
  activeNoteGroupId: string;
  designGalleryOpen: boolean;
  onProjectFilterChange: (filter: ProjectFilter) => void;
  onDesignGalleryOpenChange: (open: boolean) => void;
}

export function LibraryFilterNav({
  active,
  projectFilter,
  activeNoteGroupId,
  designGalleryOpen,
  onProjectFilterChange,
  onDesignGalleryOpenChange,
}: LibraryFilterNavProps) {
  function selectProjectFilter(filter: ProjectFilter) {
    onDesignGalleryOpenChange(false);
    onProjectFilterChange(filter);
  }

  return (
    <nav className="relative z-1 flex flex-col gap-1">
      <NavigationItem
        selected={!designGalleryOpen && !activeNoteGroupId && projectFilter === "active"}
        active={active}
        onClick={() => selectProjectFilter("active")}
      >
        <WalletCards size={16} />
        <span>全部</span>
      </NavigationItem>
      <NavigationItem
        selected={!designGalleryOpen && !activeNoteGroupId && projectFilter === "inbox"}
        active={active}
        data-sheet-move-project-id={INBOX_PROJECT_ID}
        onClick={() => selectProjectFilter("inbox")}
      >
        <Inbox size={16} />
        <span>收件箱</span>
      </NavigationItem>
      <NavigationItem
        selected={!designGalleryOpen && !activeNoteGroupId && projectFilter === "recent"}
        active={active}
        onClick={() => selectProjectFilter("recent")}
      >
        <Clock9 size={16} />
        <span>最近 7 天</span>
      </NavigationItem>
      <NavigationItem
        selected={!designGalleryOpen && !activeNoteGroupId && projectFilter === "archived"}
        active={active}
        onClick={() => selectProjectFilter("archived")}
      >
        <Archive size={16} />
        <span>已归档</span>
      </NavigationItem>
      <NavigationItem
        selected={!designGalleryOpen && !activeNoteGroupId && projectFilter === "trash"}
        active={active}
        onClick={() => selectProjectFilter("trash")}
      >
        <Trash2 size={16} />
        <span>废纸篓</span>
      </NavigationItem>
      {import.meta.env.DEV && (
        <NavigationItem selected={designGalleryOpen} active={active} onClick={() => onDesignGalleryOpenChange(true)}>
          <Palette size={16} />
          <span>设计系统</span>
        </NavigationItem>
      )}
    </nav>
  );
}
