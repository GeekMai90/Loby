import {
  Archive,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Library,
  NotebookPen,
  PanelLeftClose,
  Plus,
  Search,
  Target,
} from "lucide-react";
import clsx from "clsx";
import type { Dispatch, MouseEvent, SetStateAction } from "react";
import type { ProjectGroup, SidebarMode, WritingProject } from "../types";
import { getProjectIconColor, getProjectIconOption } from "../constants/projectAppearance";
import type { ProjectFilter } from "../lib/projectModel";
import { SidebarGlassPanel } from "./SidebarGlassPanel";

interface LibraryRailProps {
  open: boolean;
  sidebarMode: SidebarMode;
  activeProject: WritingProject;
  projectFilter: ProjectFilter;
  projectSearch: string;
  projectsOpen: boolean;
  notesOpen: boolean;
  filteredProjects: WritingProject[];
  notesGroups: ProjectGroup[];
  projectGroups: ProjectGroup[];
  resolvedActiveGroupId: string;
  activeNoteGroupId: string;
  onWindowDragStart: (event: MouseEvent<HTMLElement>) => void;
  onCreateProject: () => void;
  onCollapse: () => void;
  onProjectFilterChange: (filter: ProjectFilter) => void;
  onProjectSearchChange: (search: string) => void;
  onProjectsOpenChange: Dispatch<SetStateAction<boolean>>;
  onNotesOpenChange: Dispatch<SetStateAction<boolean>>;
  onEnterProject: (project: WritingProject) => void;
  onProjectContextMenu: (event: MouseEvent<HTMLElement>, project: WritingProject) => void;
  onSelectNoteGroup: (groupId: string) => void;
  onNoteGroupContextMenu: (event: MouseEvent<HTMLElement>, group: ProjectGroup) => void;
  onBackToLibrary: () => void;
  onRenameProject: (title: string) => void;
  onCreateProjectGroup: () => void;
  onSelectProjectGroup: (groupId: string) => void;
}

export function LibraryRail({
  open,
  sidebarMode,
  activeProject,
  projectFilter,
  projectSearch,
  projectsOpen,
  notesOpen,
  filteredProjects,
  notesGroups,
  projectGroups,
  resolvedActiveGroupId,
  activeNoteGroupId,
  onWindowDragStart,
  onCreateProject,
  onCollapse,
  onProjectFilterChange,
  onProjectSearchChange,
  onProjectsOpenChange,
  onNotesOpenChange,
  onEnterProject,
  onProjectContextMenu,
  onSelectNoteGroup,
  onNoteGroupContextMenu,
  onBackToLibrary,
  onRenameProject,
  onCreateProjectGroup,
  onSelectProjectGroup,
}: LibraryRailProps) {
  return (
    <aside className="library-rail" aria-hidden={!open}>
      <SidebarGlassPanel variant="library">
        <div className="rail-toolbar library-local-toolbar" data-tauri-drag-region onMouseDown={onWindowDragStart}>
          <div className="rail-toolbar-actions">
            {sidebarMode === "library" ? (
              <button className="icon-button rail-plain-button" onClick={onCreateProject} title="新建项目">
                <Plus size={16} />
              </button>
            ) : (
              <button className="icon-button rail-plain-button" onClick={onBackToLibrary} title="返回项目列表">
                <ArrowLeft size={16} />
              </button>
            )}
            <button className="icon-button rail-plain-button" onClick={onCollapse} title="折叠导航栏">
              <PanelLeftClose size={16} />
            </button>
          </div>
        </div>

        {sidebarMode === "library" ? (
          <LibraryModeContent
            projectFilter={projectFilter}
            projectSearch={projectSearch}
            projectsOpen={projectsOpen}
            notesOpen={notesOpen}
            filteredProjects={filteredProjects}
            notesGroups={notesGroups}
            activeNoteGroupId={activeNoteGroupId}
            onProjectFilterChange={onProjectFilterChange}
            onProjectSearchChange={onProjectSearchChange}
            onProjectsOpenChange={onProjectsOpenChange}
            onNotesOpenChange={onNotesOpenChange}
            onEnterProject={onEnterProject}
            onProjectContextMenu={onProjectContextMenu}
            onSelectNoteGroup={onSelectNoteGroup}
            onNoteGroupContextMenu={onNoteGroupContextMenu}
          />
        ) : (
          <ProjectModeContent
            activeProject={activeProject}
            projectGroups={projectGroups}
            resolvedActiveGroupId={resolvedActiveGroupId}
            onBackToLibrary={onBackToLibrary}
            onRenameProject={onRenameProject}
            onCreateProjectGroup={onCreateProjectGroup}
            onSelectProjectGroup={onSelectProjectGroup}
          />
        )}
      </SidebarGlassPanel>
    </aside>
  );
}

function LibraryModeContent({
  projectFilter,
  projectSearch,
  projectsOpen,
  notesOpen,
  filteredProjects,
  notesGroups,
  activeNoteGroupId,
  onProjectFilterChange,
  onProjectSearchChange,
  onProjectsOpenChange,
  onNotesOpenChange,
  onEnterProject,
  onProjectContextMenu,
  onSelectNoteGroup,
  onNoteGroupContextMenu,
}: Pick<
  LibraryRailProps,
  | "projectFilter"
  | "projectSearch"
  | "projectsOpen"
  | "notesOpen"
  | "filteredProjects"
  | "notesGroups"
  | "activeNoteGroupId"
  | "onProjectFilterChange"
  | "onProjectSearchChange"
  | "onProjectsOpenChange"
  | "onNotesOpenChange"
  | "onEnterProject"
  | "onProjectContextMenu"
  | "onSelectNoteGroup"
  | "onNoteGroupContextMenu"
>) {
  return (
    <>
      <nav className="nav-group">
        <button className={clsx("nav-item", projectFilter === "active" && "active")} onClick={() => onProjectFilterChange("active")}>
          <Library size={16} />
          <span>全部</span>
        </button>
        <button className={clsx("nav-item", projectFilter === "today" && "active")} onClick={() => onProjectFilterChange("today")}>
          <Target size={16} />
          <span>今日写作</span>
        </button>
        <button className={clsx("nav-item", projectFilter === "archived" && "active")} onClick={() => onProjectFilterChange("archived")}>
          <Archive size={16} />
          <span>已归档</span>
        </button>
      </nav>

      <label className="project-search">
        <Search size={14} />
        <input value={projectSearch} placeholder="搜索项目" onChange={(event) => onProjectSearchChange(event.target.value)} />
      </label>

      <div className="rail-header library-projects-header">
        <span>项目</span>
        <button
          className="icon-button section-collapse-button"
          onClick={(event) => {
            onProjectsOpenChange((value) => !value);
            event.currentTarget.blur();
          }}
          title={projectsOpen ? "折叠项目" : "展开项目"}
          aria-expanded={projectsOpen}
        >
          {projectsOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
      </div>

      {projectsOpen && (
        <div className="project-list">
          {filteredProjects.map((project) => {
            const ProjectIcon = getProjectIconOption(project.icon).Icon;
            const iconColor = getProjectIconColor(project.iconColor);
            return (
              <button
                key={project.id}
                className="project-row library-project-row"
                onClick={() => onEnterProject(project)}
                onContextMenu={(event) => onProjectContextMenu(event, project)}
              >
                <ProjectIcon size={16} style={{ color: iconColor }} />
                <span>{project.title}</span>
              </button>
            );
          })}
          {filteredProjects.length === 0 && <p className="empty-list">没有匹配的项目</p>}
        </div>
      )}

      <div className="rail-header library-projects-header">
        <span>笔记</span>
        <button
          className="icon-button section-collapse-button"
          onClick={(event) => {
            onNotesOpenChange((value) => !value);
            event.currentTarget.blur();
          }}
          title={notesOpen ? "折叠笔记" : "展开笔记"}
          aria-expanded={notesOpen}
        >
          {notesOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
      </div>

      {notesOpen && (
        <div className="project-list">
          {notesGroups.map((group) => {
            const GroupIcon = getProjectIconOption(group.icon).Icon;
            const iconColor = getProjectIconColor(group.iconColor);
            return (
              <button
                key={group.id}
                className={clsx("nav-item note-nav-item", group.id === activeNoteGroupId && "active")}
                onClick={() => onSelectNoteGroup(group.id)}
                onContextMenu={(event) => onNoteGroupContextMenu(event, group)}
              >
                <GroupIcon size={16} style={{ color: iconColor }} />
                <span>{group.title}</span>
              </button>
            );
          })}
          {notesGroups.length === 0 && (
            <button
              className="nav-item note-nav-item"
              onClick={() => onSelectNoteGroup("notes-inbox")}
              onContextMenu={(event) =>
                onNoteGroupContextMenu(event, {
                  id: "notes-inbox",
                  title: "收件箱",
                  icon: "notes",
                  iconColor: "#007aff",
                  description: "",
                })
              }
            >
              <NotebookPen size={16} />
              <span>收件箱</span>
            </button>
          )}
        </div>
      )}
    </>
  );
}

function ProjectModeContent({
  activeProject,
  projectGroups,
  resolvedActiveGroupId,
  onBackToLibrary,
  onRenameProject,
  onCreateProjectGroup,
  onSelectProjectGroup,
}: Pick<
  LibraryRailProps,
  | "activeProject"
  | "projectGroups"
  | "resolvedActiveGroupId"
  | "onBackToLibrary"
  | "onRenameProject"
  | "onCreateProjectGroup"
  | "onSelectProjectGroup"
>) {
  return (
    <>
      <div className="project-sidebar-header">
        <input value={activeProject.title} onChange={(event) => onRenameProject(event.target.value)} />
      </div>

      <div className="rail-header">
        <span>分组</span>
        <button className="icon-button" onClick={onCreateProjectGroup} title="新建分组">
          <Plus size={16} />
        </button>
      </div>

      <div className="project-list">
        {projectGroups.map((group) => {
          const GroupIcon = getProjectIconOption(group.icon).Icon;
          const iconColor = getProjectIconColor(group.iconColor);
          return (
            <button
              key={group.id}
              className={clsx("nav-item group-nav-item", group.id === resolvedActiveGroupId && "active")}
              onClick={() => onSelectProjectGroup(group.id)}
            >
              <GroupIcon size={16} style={{ color: iconColor }} />
              <span>{group.title}</span>
            </button>
          );
        })}
        {projectGroups.length === 0 && (
          <button className="empty-group-create-button" onClick={onCreateProjectGroup}>
            <Plus size={16} />
            <span>新建分组</span>
          </button>
        )}
      </div>
    </>
  );
}
