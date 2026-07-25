/**
 * [INPUT]: 依赖 lucide-react、clsx、motion/react、React 运行时、shadcn/ui 基础控件、shared 公共契约、写作库动效模型与临时悬浮协调回调
 * [OUTPUT]: 对外提供 LibraryRail
 * [POS]: 写作库 feature 的导航场景容器，在固定玻璃外壳中协调可逆进退动画、拖拽状态与共享 UI
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import clsx from "clsx";
import { AnimatePresence, motion, useIsPresent, useReducedMotion, type Transition } from "motion/react";
import { useRef, useState, type Dispatch, type MouseEvent, type PointerEvent, type ReactNode, type Ref, type SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import type { ProjectGroup, ResolvedAppTheme, SidebarMode, WritingProject } from "@/shared/types";
import type { ProjectFilter } from "@/features/library/model/projectModel";
import { LibraryModeContent, ProjectModeContent } from "@/features/library/components/LibraryRailContent";
import type { DeveloperGalleryPage, RailDragKind, RailDropPosition } from "@/features/library/components/LibraryRailTypes";
import { SidebarGlassPanel } from "@/shared/components/SidebarGlassPanel";
import { LibraryRailFooter } from "@/features/library/components/LibraryRailFooter";
import { WritingActivityPanel } from "@/features/writing-activity/components/WritingActivityPanel";
import type { WritingCheckIn } from "@/shared/types";
import { ProjectGoalProgress } from "@/features/writing-activity/components/ProjectGoalProgress";
import {
  LIBRARY_RAIL_SCENE_VARIANTS,
  libraryRailMotionDirection,
  libraryRailMotionTransition,
  type LibraryRailMotionDirection,
} from "@/features/library/model/libraryRailMotion";

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

interface LibraryRailSceneProps {
  children: ReactNode;
  direction: LibraryRailMotionDirection;
  mode: SidebarMode;
  transition: Transition;
}

function LibraryRailScene({ children, direction, mode, transition }: LibraryRailSceneProps) {
  const isPresent = useIsPresent();

  return (
    <motion.div
      className="absolute inset-0 flex min-h-0 flex-col gap-[var(--panel-gap)]"
      data-sidebar-mode={mode}
      inert={!isPresent}
      custom={direction}
      variants={LIBRARY_RAIL_SCENE_VARIANTS}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={transition}
    >
      {children}
    </motion.div>
  );
}

interface LibraryRailProps {
  railRef?: Ref<HTMLElement>;
  active: boolean;
  open: boolean;
  temporary: boolean;
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
  developerGalleryPage: DeveloperGalleryPage;
  onWindowDragStart: (event: MouseEvent<HTMLElement>) => void;
  onWindowToolbarDoubleClick: (event: MouseEvent<HTMLElement>) => void;
  onCreateProject: () => void;
  onCollapse: () => void;
  onPin: () => void;
  onTemporaryPointerEnter: () => void;
  onTemporaryPointerLeave: () => void;
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
  onDeveloperGalleryPageChange: (page: DeveloperGalleryPage) => void;
  onTemporaryAppThemeChange: (theme: ResolvedAppTheme) => void;
  onActivate: () => void;
}

export function LibraryRail({
  railRef,
  active,
  open,
  temporary,
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
  developerGalleryPage,
  onWindowDragStart,
  onWindowToolbarDoubleClick,
  onCreateProject,
  onCollapse,
  onPin,
  onTemporaryPointerEnter,
  onTemporaryPointerLeave,
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
  onDeveloperGalleryPageChange,
  onTemporaryAppThemeChange,
  onActivate,
}: LibraryRailProps) {
  const prefersReducedMotion = useReducedMotion();
  const [dragState, setDragState] = useState<RailDragState | null>(null);
  const dragStateRef = useRef<RailDragState | null>(null);
  const pointerDragRef = useRef<RailPointerDragSession | null>(null);
  const suppressNextClickRef = useRef(false);
  const sceneDirection = libraryRailMotionDirection(sidebarMode, prefersReducedMotion);
  const sceneTransition = libraryRailMotionTransition(prefersReducedMotion);

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
      ref={railRef}
      className={clsx("library-rail select-none", dragState && "is-reordering", sheetDragActive && "sheet-drag-active")}
      aria-hidden={!open}
      inert={!open}
      data-temporary={temporary || undefined}
      onPointerEnter={onTemporaryPointerEnter}
      onPointerLeave={onTemporaryPointerLeave}
      onPointerDownCapture={onActivate}
      onFocusCapture={onActivate}
    >
      <SidebarGlassPanel variant="library">
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <AnimatePresence initial={false} custom={sceneDirection}>
            <LibraryRailScene key={sidebarMode} mode={sidebarMode} direction={sceneDirection} transition={sceneTransition}>
              <div
                className="rail-toolbar library-local-toolbar"
                data-tauri-drag-region
                onMouseDown={onWindowDragStart}
                onDoubleClick={onWindowToolbarDoubleClick}
              >
                <div className="rail-toolbar-actions">
                  {sidebarMode !== "library" && (
                    <Button variant="ghost" size="icon-sm" onClick={onBackToLibrary} aria-label="返回项目列表" title="返回项目列表">
                      <LogOut className="size-3.5 [transform:scaleX(-1)]" />
                    </Button>
                  )}
                  {sidebarMode === "library" && <WritingActivityPanel checkIns={writingCheckIns} projects={writingProjects} />}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={temporary ? onPin : onCollapse}
                    aria-label={temporary ? "固定展开导航栏" : "折叠导航栏"}
                    title={temporary ? "固定展开导航栏" : "折叠导航栏"}
                  >
                    {temporary ? <PanelLeftOpen className="size-3.5" /> : <PanelLeftClose className="size-3.5" />}
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
                    developerGalleryPage={developerGalleryPage}
                    onProjectFilterChange={onProjectFilterChange}
                    onDeveloperGalleryPageChange={onDeveloperGalleryPageChange}
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
            </LibraryRailScene>
          </AnimatePresence>
        </div>
        <LibraryRailFooter
          resolvedAppTheme={resolvedAppTheme}
          onOpenSettings={onOpenSettings}
          onTemporaryAppThemeChange={onTemporaryAppThemeChange}
        />
      </SidebarGlassPanel>
    </aside>
  );
}
