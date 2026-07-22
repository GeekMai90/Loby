/**
 * [INPUT]: 依赖 clsx、lucide-react、写作库模块、shared 公共契约
 * [OUTPUT]: 对外提供 ProjectGroupsSection
 * [POS]: 写作库 feature 的界面组合单元，连接 写作库 状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import clsx from "clsx";
import { WalletCards } from "lucide-react";
import { getProjectIconColor, getProjectIconOption } from "@/features/library/constants/projectAppearance";
import type { ProjectGroup } from "@/shared/types";
import type { RailDragHandlers } from "@/features/library/components/LibraryRailTypes";
import { NavigationItem } from "@/shared/components/NavigationItem";
import { DEFAULT_USER_GROUP_ID, PROJECT_ALL_GROUP_ID } from "@/features/library/model/projectModel";

interface ProjectGroupsSectionProps extends RailDragHandlers {
  projectId: string;
  active: boolean;
  projectGroups: ProjectGroup[];
  resolvedActiveGroupId: string;
  onSelectProjectGroup: (groupId: string) => void;
}

export function ProjectGroupsSection({
  active: railActive,
  projectId,
  projectGroups,
  resolvedActiveGroupId,
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
      <div className="mb-1.5 px-1 pt-1 text-[11px] font-bold text-foreground/60">分组</div>

      <div className="flex flex-col gap-1 overflow-auto">
        <NavigationItem
          selected={resolvedActiveGroupId === PROJECT_ALL_GROUP_ID}
          active={railActive}
          onClick={(event) => {
            if (onSuppressClickAfterDrag(event)) return;
            onSelectProjectGroup(PROJECT_ALL_GROUP_ID);
          }}
        >
          <WalletCards size={16} />
          <span>全部</span>
        </NavigationItem>

        {projectGroups.map((group) => {
          const isDefaultGroup = group.id === DEFAULT_USER_GROUP_ID;
          const active = group.id === resolvedActiveGroupId;
          const GroupIcon = getProjectIconOption(group.icon).Icon;
          const iconColor = getProjectIconColor(group.iconColor);
          return (
            <NavigationItem
              key={group.id}
              selected={active}
              active={railActive}
              className={clsx(!isDefaultGroup && "rail-drag-row", !isDefaultGroup && railDropClass("project-group", group.id))}
              data-rail-drag-kind={isDefaultGroup ? undefined : "project-group"}
              data-rail-drag-id={isDefaultGroup ? undefined : group.id}
              data-sheet-move-project-id={projectId}
              data-sheet-move-group-id={group.id}
              onClick={(event) => {
                if (onSuppressClickAfterDrag(event)) return;
                onSelectProjectGroup(group.id);
              }}
              onPointerDown={(event) => {
                if (!isDefaultGroup) onStartPointerDrag("project-group", group.id, event);
              }}
              onPointerMove={onUpdatePointerDrag}
              onPointerUp={onFinishPointerDrag}
              onPointerCancel={onCancelPointerDrag}
            >
              <GroupIcon size={16} style={active || isDefaultGroup ? undefined : { color: iconColor }} />
              <span>{group.title}</span>
            </NavigationItem>
          );
        })}
      </div>
    </>
  );
}
