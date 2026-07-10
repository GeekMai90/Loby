import { Plus } from "lucide-react";
import clsx from "clsx";
import { getProjectIconColor, getProjectIconOption } from "../constants/projectAppearance";
import type { ProjectGroup } from "../types";
import type { RailDragHandlers } from "./LibraryRailTypes";

interface ProjectGroupsSectionProps extends RailDragHandlers {
  projectGroups: ProjectGroup[];
  resolvedActiveGroupId: string;
  onCreateProjectGroup: () => void;
  onSelectProjectGroup: (groupId: string) => void;
}

export function ProjectGroupsSection({
  projectGroups,
  resolvedActiveGroupId,
  onCreateProjectGroup,
  onSelectProjectGroup,
  onStartPointerDrag,
  onUpdatePointerDrag,
  onFinishPointerDrag,
  onCancelPointerDrag,
  onSuppressClickAfterDrag,
  railDropClass,
}: ProjectGroupsSectionProps) {
  return (
    <>
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
