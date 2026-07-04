import {
  Archive,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Files,
  Inbox,
  PanelLeftClose,
  Plus,
  Target,
  Trash2,
} from "lucide-react";
import clsx from "clsx";
import { useRef, useState, type Dispatch, type MouseEvent, type PointerEvent, type SetStateAction } from "react";
import type { ProjectGroup, SidebarMode, WritingProject } from "../types";
import { getProjectIconColor, getProjectIconOption } from "../constants/projectAppearance";
import type { ProjectFilter } from "../lib/projectModel";
import { SidebarGlassPanel } from "./SidebarGlassPanel";

type RailDragKind = "project" | "note-group" | "project-group";
type RailDropPosition = "before" | "after";

interface RailDragState {
  kind: RailDragKind;
  id: string;
  overId?: string;
  position?: RailDropPosition;
}

interface RailPointerDragSession {
  kind: RailDragKind;
  id: string;
  startX: number;
  startY: number;
  active: boolean;
}

interface LibraryRailProps {
  open: boolean;
  sidebarMode: SidebarMode;
  activeProject: WritingProject;
  projectFilter: ProjectFilter;
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
  onProjectsOpenChange: Dispatch<SetStateAction<boolean>>;
  onNotesOpenChange: Dispatch<SetStateAction<boolean>>;
  onEnterProject: (project: WritingProject) => void;
  onProjectContextMenu: (event: MouseEvent<HTMLElement>, project: WritingProject) => void;
  onSelectNoteGroup: (groupId: string) => void;
  onNoteGroupContextMenu: (event: MouseEvent<HTMLElement>, group: ProjectGroup) => void;
  onCreateNoteGroup: () => void;
  onReorderProjects: (sourceProjectId: string, targetProjectId: string, position: RailDropPosition) => void;
  onReorderNoteGroups: (sourceGroupId: string, targetGroupId: string, position: RailDropPosition) => void;
  onBackToLibrary: () => void;
  onRenameProject: (title: string) => void;
  onCreateProjectGroup: () => void;
  onSelectProjectGroup: (groupId: string) => void;
  onReorderProjectGroups: (sourceGroupId: string, targetGroupId: string, position: RailDropPosition) => void;
}

export function LibraryRail({
  open,
  sidebarMode,
  activeProject,
  projectFilter,
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
  onProjectsOpenChange,
  onNotesOpenChange,
  onEnterProject,
  onProjectContextMenu,
  onSelectNoteGroup,
  onNoteGroupContextMenu,
  onCreateNoteGroup,
  onReorderProjects,
  onReorderNoteGroups,
  onBackToLibrary,
  onRenameProject,
  onCreateProjectGroup,
  onSelectProjectGroup,
  onReorderProjectGroups,
}: LibraryRailProps) {
  const [dragState, setDragState] = useState<RailDragState | null>(null);
  const dragStateRef = useRef<RailDragState | null>(null);
  const pointerDragRef = useRef<RailPointerDragSession | null>(null);
  const suppressNextClickRef = useRef(false);

  function setRailDragState(nextDragState: RailDragState | null) {
    dragStateRef.current = nextDragState;
    setDragState(nextDragState);
  }

  function startRailPointerDrag(kind: RailDragKind, id: string, event: PointerEvent<HTMLElement>) {
    if (event.button !== 0) return;
    pointerDragRef.current = {
      kind,
      id,
      startX: event.clientX,
      startY: event.clientY,
      active: false,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function updateRailPointerDrag(event: PointerEvent<HTMLElement>) {
    const session = pointerDragRef.current;
    if (!session) return;

    const distance = Math.hypot(event.clientX - session.startX, event.clientY - session.startY);
    if (!session.active && distance < 4) return;
    session.active = true;
    event.preventDefault();

    const target = document.elementFromPoint(event.clientX, event.clientY);
    const targetItem = target instanceof Element ? target.closest<HTMLElement>("[data-rail-drag-kind][data-rail-drag-id]") : null;
    if (!targetItem || targetItem.dataset.railDragKind !== session.kind || targetItem.dataset.railDragId === session.id) {
      setRailDragState({ kind: session.kind, id: session.id });
      return;
    }

    const targetId = targetItem.dataset.railDragId;
    if (!targetId) return;
    const rect = targetItem.getBoundingClientRect();
    setRailDragState({
      kind: session.kind,
      id: session.id,
      overId: targetId,
      position: event.clientY > rect.top + rect.height / 2 ? "after" : "before",
    });
  }

  function finishRailPointerDrag(event: PointerEvent<HTMLElement>) {
    const session = pointerDragRef.current;
    const finalDragState = dragStateRef.current;
    event.currentTarget.releasePointerCapture?.(event.pointerId);

    if (session?.active) {
      suppressNextClickRef.current = true;
      event.preventDefault();
      event.stopPropagation();
    }

    if (session?.active && finalDragState?.overId && finalDragState.position) {
      if (finalDragState.kind === "project") onReorderProjects(finalDragState.id, finalDragState.overId, finalDragState.position);
      if (finalDragState.kind === "note-group") onReorderNoteGroups(finalDragState.id, finalDragState.overId, finalDragState.position);
      if (finalDragState.kind === "project-group") onReorderProjectGroups(finalDragState.id, finalDragState.overId, finalDragState.position);
    }

    pointerDragRef.current = null;
    setRailDragState(null);
  }

  function cancelRailPointerDrag() {
    pointerDragRef.current = null;
    setRailDragState(null);
  }

  function suppressClickAfterDrag(event: MouseEvent<HTMLElement>): boolean {
    if (!suppressNextClickRef.current) return false;
    suppressNextClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
    return true;
  }

  function railDropClass(kind: RailDragKind, id: string) {
    if (!dragState || dragState.kind !== kind) return "";
    return clsx(
      dragState.id === id && "dragging",
      dragState.overId === id && dragState.position && `drop-${dragState.position}`,
    );
  }

  return (
    <aside className={clsx("library-rail", dragState && "is-reordering")} aria-hidden={!open}>
      <SidebarGlassPanel variant="library">
        <div className="rail-toolbar library-local-toolbar" data-tauri-drag-region onMouseDown={onWindowDragStart}>
          <div className="rail-toolbar-actions">
            {sidebarMode !== "library" && (
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
            projectsOpen={projectsOpen}
            notesOpen={notesOpen}
            filteredProjects={filteredProjects}
            notesGroups={notesGroups}
            activeNoteGroupId={activeNoteGroupId}
            onProjectFilterChange={onProjectFilterChange}
            onProjectsOpenChange={onProjectsOpenChange}
            onNotesOpenChange={onNotesOpenChange}
            onEnterProject={onEnterProject}
            onProjectContextMenu={onProjectContextMenu}
            onSelectNoteGroup={onSelectNoteGroup}
            onNoteGroupContextMenu={onNoteGroupContextMenu}
            onCreateProject={onCreateProject}
            onCreateNoteGroup={onCreateNoteGroup}
            onStartPointerDrag={startRailPointerDrag}
            onUpdatePointerDrag={updateRailPointerDrag}
            onFinishPointerDrag={finishRailPointerDrag}
            onCancelPointerDrag={cancelRailPointerDrag}
            onSuppressClickAfterDrag={suppressClickAfterDrag}
            railDropClass={railDropClass}
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
            onStartPointerDrag={startRailPointerDrag}
            onUpdatePointerDrag={updateRailPointerDrag}
            onFinishPointerDrag={finishRailPointerDrag}
            onCancelPointerDrag={cancelRailPointerDrag}
            onSuppressClickAfterDrag={suppressClickAfterDrag}
            railDropClass={railDropClass}
          />
        )}
      </SidebarGlassPanel>
    </aside>
  );
}

function LibraryModeContent({
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
}: Pick<
  LibraryRailProps,
  | "projectFilter"
  | "projectsOpen"
  | "notesOpen"
  | "filteredProjects"
  | "notesGroups"
  | "activeNoteGroupId"
  | "onProjectFilterChange"
  | "onProjectsOpenChange"
  | "onNotesOpenChange"
  | "onEnterProject"
  | "onProjectContextMenu"
  | "onSelectNoteGroup"
  | "onNoteGroupContextMenu"
  | "onCreateProject"
  | "onCreateNoteGroup"
> & {
  onStartPointerDrag: (kind: RailDragKind, id: string, event: PointerEvent<HTMLElement>) => void;
  onUpdatePointerDrag: (event: PointerEvent<HTMLElement>) => void;
  onFinishPointerDrag: (event: PointerEvent<HTMLElement>) => void;
  onCancelPointerDrag: () => void;
  onSuppressClickAfterDrag: (event: MouseEvent<HTMLElement>) => boolean;
  railDropClass: (kind: RailDragKind, id: string) => string;
}) {
  return (
    <>
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

      <div className="rail-header library-projects-header">
        <span>项目</span>
        <div className="section-header-actions">
          <button className="icon-button section-action-button" onClick={() => onCreateProject()} title="新建项目">
            <Plus size={15} />
          </button>
          <button
            className="icon-button section-action-button"
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
      </div>

      {projectsOpen && (
        <div className="project-list">
          {filteredProjects.map((project) => {
            const ProjectIcon = getProjectIconOption(project.icon).Icon;
            const iconColor = getProjectIconColor(project.iconColor);
            return (
              <button
                key={project.id}
                className={clsx("project-row library-project-row", railDropClass("project", project.id))}
                data-rail-drag-kind="project"
                data-rail-drag-id={project.id}
                onClick={(event) => {
                  if (onSuppressClickAfterDrag(event)) return;
                  onEnterProject(project);
                }}
                onContextMenu={(event) => onProjectContextMenu(event, project)}
                onPointerDown={(event) => onStartPointerDrag("project", project.id, event)}
                onPointerMove={onUpdatePointerDrag}
                onPointerUp={onFinishPointerDrag}
                onPointerCancel={onCancelPointerDrag}
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
        <div className="section-header-actions">
          <button className="icon-button section-action-button" onClick={() => onCreateNoteGroup()} title="新建笔记分组">
            <Plus size={15} />
          </button>
          <button
            className="icon-button section-action-button"
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
      </div>

      {notesOpen && (
        <div className="project-list">
          {notesGroups.map((group) => {
            const isInbox = group.id === "notes-inbox";
            const GroupIcon = isInbox ? Inbox : getProjectIconOption(group.icon).Icon;
            const iconColor = isInbox ? "#8e8e93" : getProjectIconColor(group.iconColor);
            return (
              <button
                key={group.id}
                className={clsx(
                  "nav-item note-nav-item",
                  group.id === activeNoteGroupId && "active",
                  !isInbox && railDropClass("note-group", group.id),
                )}
                data-rail-drag-kind={isInbox ? undefined : "note-group"}
                data-rail-drag-id={isInbox ? undefined : group.id}
                onClick={(event) => {
                  if (onSuppressClickAfterDrag(event)) return;
                  onSelectNoteGroup(group.id);
                }}
                onContextMenu={(event) => onNoteGroupContextMenu(event, group)}
                onPointerDown={(event) => {
                  if (!isInbox) onStartPointerDrag("note-group", group.id, event);
                }}
                onPointerMove={onUpdatePointerDrag}
                onPointerUp={onFinishPointerDrag}
                onPointerCancel={onCancelPointerDrag}
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
                  icon: "inbox",
                  iconColor: "#8e8e93",
                  description: "",
                })
              }
            >
              <Inbox size={16} style={{ color: "#8e8e93" }} />
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
  onStartPointerDrag,
  onUpdatePointerDrag,
  onFinishPointerDrag,
  onCancelPointerDrag,
  onSuppressClickAfterDrag,
  railDropClass,
}: Pick<
  LibraryRailProps,
  | "activeProject"
  | "projectGroups"
  | "resolvedActiveGroupId"
  | "onBackToLibrary"
  | "onRenameProject"
  | "onCreateProjectGroup"
  | "onSelectProjectGroup"
> & {
  onStartPointerDrag: (kind: RailDragKind, id: string, event: PointerEvent<HTMLElement>) => void;
  onUpdatePointerDrag: (event: PointerEvent<HTMLElement>) => void;
  onFinishPointerDrag: (event: PointerEvent<HTMLElement>) => void;
  onCancelPointerDrag: () => void;
  onSuppressClickAfterDrag: (event: MouseEvent<HTMLElement>) => boolean;
  railDropClass: (kind: RailDragKind, id: string) => string;
}) {
  return (
    <>
      <div className="project-sidebar-header">
        <input value={activeProject.title} onChange={(event) => onRenameProject(event.target.value)} />
      </div>

      <div className="rail-header">
        <span>分组</span>
        <button className="icon-button" onClick={() => onCreateProjectGroup()} title="新建分组">
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
              className={clsx(
                "nav-item group-nav-item",
                group.id === resolvedActiveGroupId && "active",
                railDropClass("project-group", group.id),
              )}
              data-rail-drag-kind="project-group"
              data-rail-drag-id={group.id}
              onClick={(event) => {
                if (onSuppressClickAfterDrag(event)) return;
                onSelectProjectGroup(group.id);
              }}
              onPointerDown={(event) => onStartPointerDrag("project-group", group.id, event)}
              onPointerMove={onUpdatePointerDrag}
              onPointerUp={onFinishPointerDrag}
              onPointerCancel={onCancelPointerDrag}
            >
              <GroupIcon size={16} style={{ color: iconColor }} />
              <span>{group.title}</span>
            </button>
          );
        })}
        {projectGroups.length === 0 && (
          <button className="empty-group-create-button" onClick={() => onCreateProjectGroup()}>
            <Plus size={16} />
            <span>新建分组</span>
          </button>
        )}
      </div>
    </>
  );
}
