/**
 * [INPUT]: 依赖 lucide-react、写作库模块、shared 公共契约与 Vite 开发环境标记
 * [OUTPUT]: 对外提供含全局收藏筛选入口的 LibraryFilterNav
 * [POS]: 写作库的一级导航列表；收藏紧随收件箱且不表示文件夹，开发态在废纸篓后连续追加设计系统与颜色系统入口
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Archive, Clock9, Inbox, Palette, Star, SwatchBook, Trash2, WalletCards } from "lucide-react";
import type { DeveloperGalleryPage } from "@/features/library/components/LibraryRailTypes";
import { INBOX_PROJECT_ID } from "@/features/library/model/projectModel";
import type { ProjectFilter } from "@/features/library/model/projectModel";
import { NavigationItem } from "@/shared/components/NavigationItem";

interface LibraryFilterNavProps {
  active: boolean;
  projectFilter: ProjectFilter;
  activeNoteGroupId: string;
  developerGalleryPage: DeveloperGalleryPage;
  onProjectFilterChange: (filter: ProjectFilter) => void;
  onDeveloperGalleryPageChange: (page: DeveloperGalleryPage) => void;
}

export function LibraryFilterNav({
  active,
  projectFilter,
  activeNoteGroupId,
  developerGalleryPage,
  onProjectFilterChange,
  onDeveloperGalleryPageChange,
}: LibraryFilterNavProps) {
  function selectProjectFilter(filter: ProjectFilter) {
    onDeveloperGalleryPageChange(null);
    onProjectFilterChange(filter);
  }

  return (
    <nav className="relative z-1 flex flex-col gap-1">
      <NavigationItem
        selected={!developerGalleryPage && !activeNoteGroupId && projectFilter === "active"}
        active={active}
        onClick={() => selectProjectFilter("active")}
      >
        <WalletCards />
        <span>全部</span>
      </NavigationItem>
      <NavigationItem
        selected={!developerGalleryPage && !activeNoteGroupId && projectFilter === "inbox"}
        active={active}
        data-sheet-move-project-id={INBOX_PROJECT_ID}
        onClick={() => selectProjectFilter("inbox")}
      >
        <Inbox />
        <span>收件箱</span>
      </NavigationItem>
      <NavigationItem
        selected={!developerGalleryPage && !activeNoteGroupId && projectFilter === "favorites"}
        active={active}
        onClick={() => selectProjectFilter("favorites")}
      >
        <Star />
        <span>收藏</span>
      </NavigationItem>
      <NavigationItem
        selected={!developerGalleryPage && !activeNoteGroupId && projectFilter === "recent"}
        active={active}
        onClick={() => selectProjectFilter("recent")}
      >
        <Clock9 />
        <span>最近 7 天</span>
      </NavigationItem>
      <NavigationItem
        selected={!developerGalleryPage && !activeNoteGroupId && projectFilter === "archived"}
        active={active}
        onClick={() => selectProjectFilter("archived")}
      >
        <Archive />
        <span>已归档</span>
      </NavigationItem>
      <NavigationItem
        selected={!developerGalleryPage && !activeNoteGroupId && projectFilter === "trash"}
        active={active}
        onClick={() => selectProjectFilter("trash")}
      >
        <Trash2 />
        <span>废纸篓</span>
      </NavigationItem>
      {import.meta.env.DEV && (
        <>
          <NavigationItem
            selected={developerGalleryPage === "design-system"}
            active={active}
            onClick={() => onDeveloperGalleryPageChange("design-system")}
          >
            <Palette />
            <span>设计系统</span>
          </NavigationItem>
          <NavigationItem
            selected={developerGalleryPage === "color-system"}
            active={active}
            onClick={() => onDeveloperGalleryPageChange("color-system")}
          >
            <SwatchBook />
            <span>颜色系统</span>
          </NavigationItem>
        </>
      )}
    </nav>
  );
}
