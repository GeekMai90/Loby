import { ArrowLeft, FolderPlus, Settings2 } from "lucide-react";
import type { Dispatch, MouseEvent, SetStateAction } from "react";
import type { ProjectFilter } from "../lib/projectModel";
import type { ProjectGroup, WritingProject } from "../types";
import { LibraryFilterNav, LibraryNotesSection, LibraryProjectsSection, ProjectGroupsSection } from "./LibraryRailSections";
import type { RailDragHandlers } from "./LibraryRailTypes";
import { Button } from "@/components/ui/button";
import { ProjectInformationPopover } from "./ProjectInformationPopover";

interface LibraryModeContentProps extends RailDragHandlers {
  active: boolean;
  projectFilter: ProjectFilter;
  projectsOpen: boolean;
  notesOpen: boolean;
  filteredProjects: WritingProject[];
  notesGroups: ProjectGroup[];
  activeNoteGroupId: string;
  onProjectFilterChange: (filter: ProjectFilter) => void;
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
  sheetDragActive: boolean;
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
  onProjectFilterChange,
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
        onProjectFilterChange={onProjectFilterChange}
      />

      <LibraryProjectsSection
        open={projectsOpen}
        filteredProjects={filteredProjects}
        onToggleOpen={() => onProjectsOpenChange((value) => !value)}
        onCreateProject={onCreateProject}
        onEnterProject={onEnterProject}
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
        onSelectNoteGroup={onSelectNoteGroup}
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
  sheetDragActive,
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
        <div className="project-title-drag-row flex min-w-0 items-center gap-2">
          <strong className="block min-w-0 max-w-[68%] truncate py-0.75 pb-1 text-[17px] leading-5.5 font-bold" title={activeProject.title}>
            {activeProject.title}
          </strong>
          {sheetDragActive && (
            <div className="sheet-drag-return-zone" data-sheet-drag-return-library aria-hidden="true">
              <ArrowLeft size={13} />
              <span>返回全部</span>
            </div>
          )}
        </div>
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
