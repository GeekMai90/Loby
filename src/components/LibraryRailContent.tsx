import type { Dispatch, MouseEvent, SetStateAction } from "react";
import type { ProjectFilter } from "../lib/projectModel";
import type { ProjectGroup, WritingProject } from "../types";
import { LibraryFilterNav, LibraryNotesSection, LibraryProjectsSection, ProjectGroupsSection } from "./LibraryRailSections";
import type { RailDragHandlers } from "./LibraryRailTypes";

interface LibraryModeContentProps extends RailDragHandlers {
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
  activeProject: WritingProject;
  projectGroups: ProjectGroup[];
  resolvedActiveGroupId: string;
  onRenameProject: (title: string) => void;
  onCreateProjectGroup: () => void;
  onSelectProjectGroup: (groupId: string) => void;
}

export function LibraryModeContent({
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
      <LibraryFilterNav projectFilter={projectFilter} activeNoteGroupId={activeNoteGroupId} onProjectFilterChange={onProjectFilterChange} />

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
  activeProject,
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
      <div className="project-sidebar-header">
        <input value={activeProject.title} onChange={(event) => onRenameProject(event.target.value)} />
      </div>

      <ProjectGroupsSection
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
