import { ArrowLeft, PanelLeftClose } from "lucide-react";
import clsx from "clsx";
import { useRef, useState, type Dispatch, type MouseEvent, type PointerEvent, type SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import type { ProjectGroup, SidebarMode, WritingLibrary, WritingProject } from "../types";
import type { ProjectFilter } from "../lib/projectModel";
import { LibraryModeContent, ProjectModeContent } from "./LibraryRailContent";
import type { RailDragKind, RailDropPosition } from "./LibraryRailTypes";
import { SidebarGlassPanel } from "./SidebarGlassPanel";
import { LibrarySwitcher } from "./LibrarySwitcher";
import { WritingActivityPanel } from "./WritingActivityPanel";
import type { WritingCheckIn } from "../types";
import { ProjectGoalProgress } from "./ProjectGoalProgress";

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
  active: boolean;
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
  libraries: WritingLibrary[];
  activeLibrary?: WritingLibrary;
  sheetDragActive: boolean;
  writingCheckIns: WritingCheckIn[];
  writingProjects: WritingProject[];
  onWindowDragStart: (event: MouseEvent<HTMLElement>) => void;
  onWindowToolbarDoubleClick: (event: MouseEvent<HTMLElement>) => void;
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
  onEditProject: (project: WritingProject) => void;
  onCreateProjectGroup: () => void;
  onSelectProjectGroup: (groupId: string) => void;
  onReorderProjectGroups: (sourceGroupId: string, targetGroupId: string, position: RailDropPosition) => void;
  onSwitchLibrary: (libraryId: string) => Promise<void>;
  onOpenLibraryManager: () => void;
  onOpenSettings: () => void;
  onActivate: () => void;
}

export function LibraryRail({
  active,
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
  libraries,
  activeLibrary,
  sheetDragActive,
  writingCheckIns,
  writingProjects,
  onWindowDragStart,
  onWindowToolbarDoubleClick,
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
  onEditProject,
  onCreateProjectGroup,
  onSelectProjectGroup,
  onReorderProjectGroups,
  onSwitchLibrary,
  onOpenLibraryManager,
  onOpenSettings,
  onActivate,
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
      if (finalDragState.kind === "project-group")
        onReorderProjectGroups(finalDragState.id, finalDragState.overId, finalDragState.position);
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
    return clsx(dragState.id === id && "dragging", dragState.overId === id && dragState.position && `drop-${dragState.position}`);
  }

  return (
    <aside
      className={clsx("library-rail select-none", dragState && "is-reordering", sheetDragActive && "sheet-drag-active")}
      aria-hidden={!open}
      onPointerDownCapture={onActivate}
      onFocusCapture={onActivate}
    >
      <SidebarGlassPanel variant="library">
        <div
          className="rail-toolbar library-local-toolbar"
          data-tauri-drag-region
          onMouseDown={onWindowDragStart}
          onDoubleClick={onWindowToolbarDoubleClick}
        >
          <div className="rail-toolbar-actions">
            {sidebarMode !== "library" && (
              <Button variant="ghost" size="icon" onClick={onBackToLibrary} title="返回项目列表">
                <ArrowLeft className="size-[17px]" />
              </Button>
            )}
            {sidebarMode === "library" && <WritingActivityPanel checkIns={writingCheckIns} projects={writingProjects} />}
            <Button variant="ghost" size="icon" onClick={onCollapse} title="折叠导航栏">
              <PanelLeftClose className="size-[17px]" />
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          {sidebarMode === "library" ? (
            <LibraryModeContent
              active={active}
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
              active={active}
              activeProject={activeProject}
              sheetDragActive={sheetDragActive}
              projectGroups={projectGroups}
              resolvedActiveGroupId={resolvedActiveGroupId}
              onEditProject={() => onEditProject(activeProject)}
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
        </div>
        {sidebarMode === "project" && <ProjectGoalProgress project={activeProject} />}
        <LibrarySwitcher
          libraries={libraries}
          activeLibrary={activeLibrary}
          onSwitchLibrary={onSwitchLibrary}
          onOpenManager={onOpenLibraryManager}
          onOpenSettings={onOpenSettings}
        />
      </SidebarGlassPanel>
    </aside>
  );
}
