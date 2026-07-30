/**
 * [INPUT]: 依赖 lucide-react、React 运行时、写作库模块、shared 公共契约、shadcn/ui 基础控件
 * [OUTPUT]: 对外提供 LibraryModeContent、ProjectModeContent
 * [POS]: 写作库 feature 的界面组合单元，连接 写作库 状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { FolderPlus, Settings2 } from "lucide-react";
import type { Dispatch, MouseEvent, SetStateAction } from "react";
import type { ProjectFilter } from "@/features/library/model/projectModel";
import type { ProjectGroup, WritingProject } from "@/shared/types";
import {
  LibraryFilterNav,
  LibraryNotesSection,
  LibraryProjectsSection,
  ProjectGroupsSection,
} from "@/features/library/components/LibraryRailSections";
import type { DeveloperGalleryPage, RailDragHandlers } from "@/features/library/components/LibraryRailTypes";
import { Button } from "@/components/ui/button";
import { ProjectInformationPopover } from "@/features/library/components/ProjectInformationPopover";

interface LibraryModeContentProps extends RailDragHandlers {
  active: boolean;
  projectFilter: ProjectFilter;
  projectsOpen: boolean;
  notesOpen: boolean;
  filteredProjects: WritingProject[];
  notesGroups: ProjectGroup[];
  activeNoteGroupId: string;
  developerGalleryPage: DeveloperGalleryPage;
  onProjectFilterChange: (filter: ProjectFilter) => void;
  onDeveloperGalleryPageChange: (page: DeveloperGalleryPage) => void;
  onProjectsOpenChange: Dispatch<SetStateAction<boolean>>;
  onNotesOpenChange: Dispatch<SetStateAction<boolean>>;
  onEnterProject: (project: WritingProject) => void;
  onProjectContextMenu: (event: MouseEvent<HTMLElement>, project: WritingProject) => void;
  onSelectNoteGroup: (groupId: string) => void;
  onNoteGroupContextMenu: (event: MouseEvent<HTMLElement>, group: ProjectGroup) => void;
  onCreateProject: () => void;
  onCreateNoteGroup: () => void;
}

interface ProjectModeContentProps extends RailDragHandlers {
  active: boolean;
  activeProject: WritingProject;
  projectGroups: ProjectGroup[];
  resolvedActiveGroupId: string;
  onEditProject: () => void;
  onCreateProjectGroup: () => void;
  onSelectProjectGroup: (groupId: string) => void;
}

export function LibraryModeContent({
  active,
  projectFilter,
  projectsOpen,
  notesOpen,
  filteredProjects,
  notesGroups,
  activeNoteGroupId,
  developerGalleryPage,
  onProjectFilterChange,
  onDeveloperGalleryPageChange,
  onProjectsOpenChange,
  onNotesOpenChange,
  onEnterProject,
  onProjectContextMenu,
  onSelectNoteGroup,
  onNoteGroupContextMenu,
  onCreateProject,
  onCreateNoteGroup,
  onStartPointerDrag,
  onUpdatePointerDrag,
  onFinishPointerDrag,
  onCancelPointerDrag,
  onSuppressClickAfterDrag,
  railDropClass,
}: LibraryModeContentProps) {
  return (
    <>
      <LibraryFilterNav
        active={active}
        projectFilter={projectFilter}
        activeNoteGroupId={activeNoteGroupId}
        developerGalleryPage={developerGalleryPage}
        onProjectFilterChange={onProjectFilterChange}
        onDeveloperGalleryPageChange={onDeveloperGalleryPageChange}
      />

      <LibraryProjectsSection
        open={projectsOpen}
        filteredProjects={filteredProjects}
        onToggleOpen={() => onProjectsOpenChange((value) => !value)}
        onCreateProject={onCreateProject}
        onEnterProject={(project) => {
          onDeveloperGalleryPageChange(null);
          onEnterProject(project);
        }}
        onProjectContextMenu={onProjectContextMenu}
        onStartPointerDrag={onStartPointerDrag}
        onUpdatePointerDrag={onUpdatePointerDrag}
        onFinishPointerDrag={onFinishPointerDrag}
        onCancelPointerDrag={onCancelPointerDrag}
        onSuppressClickAfterDrag={onSuppressClickAfterDrag}
        railDropClass={railDropClass}
      />

      <LibraryNotesSection
        active={active}
        open={notesOpen}
        notesGroups={notesGroups}
        activeNoteGroupId={activeNoteGroupId}
        onToggleOpen={() => onNotesOpenChange((value) => !value)}
        onCreateNoteGroup={onCreateNoteGroup}
        onSelectNoteGroup={(groupId) => {
          onDeveloperGalleryPageChange(null);
          onSelectNoteGroup(groupId);
        }}
        onNoteGroupContextMenu={onNoteGroupContextMenu}
        onStartPointerDrag={onStartPointerDrag}
        onUpdatePointerDrag={onUpdatePointerDrag}
        onFinishPointerDrag={onFinishPointerDrag}
        onCancelPointerDrag={onCancelPointerDrag}
        onSuppressClickAfterDrag={onSuppressClickAfterDrag}
        railDropClass={railDropClass}
      />
    </>
  );
}

export function ProjectModeContent({
  active,
  activeProject,
  projectGroups,
  resolvedActiveGroupId,
  onEditProject,
  onCreateProjectGroup,
  onSelectProjectGroup,
  onStartPointerDrag,
  onUpdatePointerDrag,
  onFinishPointerDrag,
  onCancelPointerDrag,
  onSuppressClickAfterDrag,
  railDropClass,
}: ProjectModeContentProps) {
  return (
    <>
      <div className="flex flex-col gap-1.5 border-b border-[var(--sidebar-stroke)] px-1 pt-0.5 pb-3">
        <strong className="block min-w-0 truncate py-0.75 pb-1 text-[17px] leading-5.5 font-bold" title={activeProject.title}>
          {activeProject.title}
        </strong>
        <div className="-ml-2 flex items-center gap-0">
          <ProjectInformationPopover project={activeProject} />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-foreground"
            onClick={onCreateProjectGroup}
            title="新建分组"
            aria-label="新建分组"
          >
            <FolderPlus size={14} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-foreground"
            onClick={onEditProject}
            title="项目设置"
            aria-label="项目设置"
          >
            <Settings2 size={14} />
          </Button>
        </div>
      </div>

      <ProjectGroupsSection
        active={active}
        projectId={activeProject.id}
        projectGroups={projectGroups}
        resolvedActiveGroupId={resolvedActiveGroupId}
        onSelectProjectGroup={onSelectProjectGroup}
        onStartPointerDrag={onStartPointerDrag}
        onUpdatePointerDrag={onUpdatePointerDrag}
        onFinishPointerDrag={onFinishPointerDrag}
        onCancelPointerDrag={onCancelPointerDrag}
        onSuppressClickAfterDrag={onSuppressClickAfterDrag}
        railDropClass={railDropClass}
      />
    </>
  );
}
