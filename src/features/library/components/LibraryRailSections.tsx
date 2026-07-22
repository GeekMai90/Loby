/**
 * [INPUT]: 依赖 写作库模块
 * [OUTPUT]: 对外提供 LibraryFilterNav、LibraryNotesSection、LibraryProjectsSection、ProjectGroupsSection
 * [POS]: 写作库 feature 的界面组合单元，连接 写作库 状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
export { LibraryFilterNav } from "@/features/library/components/LibraryFilterNav";
export { LibraryNotesSection } from "@/features/library/components/LibraryNotesSection";
export { LibraryProjectsSection } from "@/features/library/components/LibraryProjectsSection";
export { ProjectGroupsSection } from "@/features/library/components/ProjectGroupsSection";
