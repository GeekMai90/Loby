import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import clsx from "clsx";
import type { MouseEvent } from "react";
import { getProjectIconColor, getProjectIconOption } from "../constants/projectAppearance";
import type { WritingProject } from "../types";
import type { RailDragHandlers } from "./LibraryRailTypes";

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
      <div className="rail-header library-projects-header">
        <span>项目</span>
        <div className="section-header-actions">
          <button className="icon-button section-action-button" onClick={() => onCreateProject()} title="新建项目">
            <Plus size={15} />
          </button>
          <button
            className="icon-button section-action-button"
            onClick={(event) => {
              onToggleOpen();
              event.currentTarget.blur();
            }}
            title={open ? "折叠项目" : "展开项目"}
            aria-expanded={open}
          >
            {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>
      </div>

      {open && (
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
    </>
  );
}
