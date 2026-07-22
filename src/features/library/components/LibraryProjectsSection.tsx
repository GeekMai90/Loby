/**
 * [INPUT]: 依赖 lucide-react、clsx、React 运行时、shadcn/ui 基础控件、shared 公共契约、写作库模块
 * [OUTPUT]: 对外提供 LibraryProjectsSection
 * [POS]: 写作库 feature 的项目入口列表，复用统一导航项并为进入层级提供克制的按压反馈
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { ChevronDown, ChevronUp, LogIn, Plus } from "lucide-react";
import clsx from "clsx";
import type { MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import { APP_SHORTCUTS, appShortcutAriaKeys, appShortcutTitle } from "@/shared/lib/keyboardShortcuts";
import { getProjectIconColor, getProjectIconOption } from "@/features/library/constants/projectAppearance";
import type { WritingProject } from "@/shared/types";
import type { RailDragHandlers } from "@/features/library/components/LibraryRailTypes";
import { NavigationItem } from "@/shared/components/NavigationItem";

interface LibraryProjectsSectionProps extends RailDragHandlers {
  open: boolean;
  filteredProjects: WritingProject[];
  onToggleOpen: () => void;
  onCreateProject: () => void;
  onEnterProject: (project: WritingProject) => void;
  onProjectContextMenu: (event: MouseEvent<HTMLElement>, project: WritingProject) => void;
}

export function LibraryProjectsSection({
  open,
  filteredProjects,
  onToggleOpen,
  onCreateProject,
  onEnterProject,
  onProjectContextMenu,
  onStartPointerDrag,
  onUpdatePointerDrag,
  onFinishPointerDrag,
  onCancelPointerDrag,
  onSuppressClickAfterDrag,
  railDropClass,
}: LibraryProjectsSectionProps) {
  return (
    <>
      <div className="text-caption group flex items-center justify-between gap-2 px-1 pt-1 font-bold text-foreground/60">
        <span>项目</span>
        <div className="pointer-events-none flex items-center opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
          <Button
            variant="ghost"
            size="icon-sm"
            surface="transparent"
            className="hover:text-foreground"
            onClick={() => onCreateProject()}
            title={appShortcutTitle("newProject")}
            aria-keyshortcuts={appShortcutAriaKeys(APP_SHORTCUTS.newProject)}
          >
            <Plus />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            surface="transparent"
            className="hover:text-foreground"
            onClick={(event) => {
              onToggleOpen();
              event.currentTarget.blur();
            }}
            title={open ? "折叠项目" : "展开项目"}
            aria-expanded={open}
          >
            {open ? <ChevronUp /> : <ChevronDown />}
          </Button>
        </div>
      </div>

      {open && (
        <div className="flex flex-col gap-1 overflow-auto">
          {filteredProjects.map((project) => {
            const ProjectIcon = getProjectIconOption(project.icon).Icon;
            const iconColor = getProjectIconColor(project.iconColor);
            return (
              <NavigationItem
                key={project.id}
                className={clsx(
                  "group/project rail-drag-row transition-[transform,background-color] duration-75 ease-out active:scale-[0.985] active:bg-foreground/5 motion-reduce:transition-none",
                  railDropClass("project", project.id),
                )}
                data-rail-drag-kind="project"
                data-rail-drag-id={project.id}
                data-sheet-move-project-id={project.id}
                data-sheet-hover-project-id={project.id}
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
                <span className="sheet-drag-project-icon">
                  <ProjectIcon className="group-hover/project:hidden" style={{ color: iconColor }} />
                  <LogIn aria-hidden="true" className="hidden group-hover/project:block" />
                </span>
                <span className="min-w-0 flex-1 truncate text-left">{project.title}</span>
              </NavigationItem>
            );
          })}
          {filteredProjects.length === 0 && <p className="mx-1 my-2 text-xs leading-4.5 text-muted-foreground">没有匹配的项目</p>}
        </div>
      )}
    </>
  );
}
