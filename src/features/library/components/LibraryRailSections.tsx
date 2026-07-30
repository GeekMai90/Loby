/**
 * [INPUT]: 依赖 library/components 的筛选、随手记、项目与项目分组四个导航区块
 * [OUTPUT]: 对外提供 LibraryFilterNav、LibraryNotesSection、LibraryProjectsSection、ProjectGroupsSection
 * [POS]: 写作库导航区块的稳定聚合出口，不拥有 rail 状态、排序或拖拽行为
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
export { LibraryFilterNav } from "@/features/library/components/LibraryFilterNav";
export { LibraryNotesSection } from "@/features/library/components/LibraryNotesSection";
export { LibraryProjectsSection } from "@/features/library/components/LibraryProjectsSection";
export { ProjectGroupsSection } from "@/features/library/components/ProjectGroupsSection";
