/**
 * [INPUT]: 依赖 lucide-react、clsx、React 运行时、shadcn/ui 基础控件、shared 公共契约、写作库模块
 * [OUTPUT]: 对外提供 LibraryRail
 * [POS]: 写作库 feature 的界面组合单元，连接 写作库 状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { ArrowLeft, PanelLeftClose } from "lucide-react";
import clsx from "clsx";
import { useRef, useState, type Dispatch, type MouseEvent, type PointerEvent, type SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import type { ProjectGroup, ResolvedAppTheme, SidebarMode, WritingProject } from "@/shared/types";
import type { ProjectFilter } from "@/features/library/model/projectModel";
import { LibraryModeContent, ProjectModeContent } from "@/features/library/components/LibraryRailContent";
import type { RailDragKind, RailDropPosition } from "@/features/library/components/LibraryRailTypes";
import { SidebarGlassPanel } from "@/shared/components/SidebarGlassPanel";
import { LibraryRailFooter } from "@/features/library/components/LibraryRailFooter";
import { WritingActivityPanel } from "@/features/writing-activity/components/WritingActivityPanel";
import type { WritingCheckIn } from "@/shared/types";
import { ProjectGoalProgress } from "@/features/writing-activity/components/ProjectGoalProgress";

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
  sheetDragActive: boolean;
  writingCheckIns: WritingCheckIn[];
  writingProjects: WritingProject[];
  resolvedAppTheme: ResolvedAppTheme;
  designGalleryOpen: boolean;
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
  onOpenSettings: () => void;
  onDesignGalleryOpenChange: (open: boolean) => void;
  onTemporaryAppThemeChange: (theme: ResolvedAppTheme) => void;
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
  sheetDragActive,
  writingCheckIns,
  writingProjects,
  resolvedAppTheme,
  designGalleryOpen,
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
  onOpenSettings,
  onDesignGalleryOpenChange,
  onTemporaryAppThemeChange,
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
              <Button variant="ghost" size="icon" surface="transparent" onClick={onBackToLibrary} title="返回项目列表">
                <ArrowLeft className="size-[17px]" />
              </Button>
            )}
            {sidebarMode === "library" && <WritingActivityPanel checkIns={writingCheckIns} projects={writingProjects} />}
            <Button variant="ghost" size="icon" surface="transparent" onClick={onCollapse} title="折叠导航栏">
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
              designGalleryOpen={designGalleryOpen}
              onProjectFilterChange={onProjectFilterChange}
              onDesignGalleryOpenChange={onDesignGalleryOpenChange}
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
        <LibraryRailFooter
          resolvedAppTheme={resolvedAppTheme}
          onOpenSettings={onOpenSettings}
          onTemporaryAppThemeChange={onTemporaryAppThemeChange}
        />
      </SidebarGlassPanel>
    </aside>
  );
}
