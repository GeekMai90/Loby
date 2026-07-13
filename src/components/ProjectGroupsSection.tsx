import { Plus } from "lucide-react";
import clsx from "clsx";
import { Button } from "@/components/ui/button";
import { getProjectIconColor, getProjectIconOption } from "../constants/projectAppearance";
import type { ProjectGroup } from "../types";
import type { RailDragHandlers } from "./LibraryRailTypes";
import { NavigationItem } from "./NavigationItem";

interface ProjectGroupsSectionProps extends RailDragHandlers {
  active: boolean;
  projectGroups: ProjectGroup[];
  resolvedActiveGroupId: string;
  onCreateProjectGroup: () => void;
  onSelectProjectGroup: (groupId: string) => void;
}

export function ProjectGroupsSection({
  active: railActive,
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
      <div className="flex items-center justify-between gap-2 px-1 pt-1 text-[11px] font-bold text-foreground/60">
        <span>分组</span>
        <Button variant="ghost" size="icon-sm" onClick={() => onCreateProjectGroup()} title="新建分组">
          <Plus />
        </Button>
      </div>

      <div className="flex flex-col gap-1 overflow-auto">
        {projectGroups.map((group) => {
          const active = group.id === resolvedActiveGroupId;
          const GroupIcon = getProjectIconOption(group.icon).Icon;
          const iconColor = getProjectIconColor(group.iconColor);
          return (
            <NavigationItem
              key={group.id}
              selected={active}
              active={railActive}
              className={clsx("rail-drag-row", railDropClass("project-group", group.id))}
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
              <GroupIcon size={16} style={active ? undefined : { color: iconColor }} />
              <span>{group.title}</span>
            </NavigationItem>
          );
        })}
        {projectGroups.length === 0 && (
          <Button type="button" variant="outline" className="w-full" onClick={() => onCreateProjectGroup()}>
            <Plus size={16} />
            <span>新建分组</span>
          </Button>
        )}
      </div>
    </>
  );
}
