import { ArrowLeft } from "lucide-react";
import type { Dispatch, MouseEvent, SetStateAction } from "react";
import type { ProjectFilter } from "../lib/projectModel";
import type { ProjectGroup, WritingProject } from "../types";
import { LibraryFilterNav, LibraryNotesSection, LibraryProjectsSection, ProjectGroupsSection } from "./LibraryRailSections";
import type { RailDragHandlers } from "./LibraryRailTypes";
import { Input } from "@/components/ui/input";

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
  onRenameProject: (title: string) => void;
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
  onRenameProject,
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
          <Input
            className="h-auto max-w-[68%] min-w-[3em] flex-none border-0 bg-transparent px-0 text-[21px] leading-tight font-bold shadow-none focus-visible:ring-0"
            style={{ width: `${Math.min(Math.max(Array.from(activeProject.title).length + 1, 3), 12)}em` }}
            value={activeProject.title}
            onChange={(event) => onRenameProject(event.target.value)}
          />
          {sheetDragActive && (
            <div className="sheet-drag-return-zone" data-sheet-drag-return-library aria-hidden="true">
              <ArrowLeft size={13} />
              <span>返回全部</span>
            </div>
          )}
        </div>
      </div>

      <ProjectGroupsSection
        active={active}
        projectId={activeProject.id}
        projectGroups={projectGroups}
        resolvedActiveGroupId={resolvedActiveGroupId}
        onCreateProjectGroup={onCreateProjectGroup}
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
