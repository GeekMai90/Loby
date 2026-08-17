/**
 * [INPUT]: 依赖 lucide-react、clsx、React 运行时、shadcn/ui 基础控件、写作库模块、shared 公共契约
 * [OUTPUT]: 对外提供 LibraryNotesSection
 * [POS]: 写作库 feature 的界面组合单元，连接 写作库 状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { ChevronDown, ChevronUp, NotebookPen, Plus } from "lucide-react";
import clsx from "clsx";
import type { MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import { DEFAULT_SYSTEM_ICON_COLOR, getProjectIconColor, getProjectIconOption } from "@/features/library/constants/projectAppearance";
import type { ProjectGroup } from "@/shared/types";
import type { RailDragHandlers } from "@/features/library/components/LibraryRailTypes";
import { NavigationItem } from "@/shared/components/NavigationItem";
import { NOTES_PROJECT_ID, NOTES_QUICK_GROUP_ID } from "@/features/library/model/projectModel";

interface LibraryNotesSectionProps extends RailDragHandlers {
  active: boolean;
  open: boolean;
  notesGroups: ProjectGroup[];
  activeNoteGroupId: string;
  onToggleOpen: () => void;
  onCreateNoteGroup: () => void;
  onSelectNoteGroup: (groupId: string) => void;
  onNoteGroupContextMenu: (event: MouseEvent<HTMLElement>, group: ProjectGroup) => void;
}

const QUICK_NOTES_GROUP: ProjectGroup = {
  id: NOTES_QUICK_GROUP_ID,
  title: "随手记",
  icon: "notes",
  iconColor: DEFAULT_SYSTEM_ICON_COLOR,
  description: "",
};

export function LibraryNotesSection({
  active: railActive,
  open,
  notesGroups,
  activeNoteGroupId,
  onToggleOpen,
  onCreateNoteGroup,
  onSelectNoteGroup,
  onNoteGroupContextMenu,
  onStartPointerDrag,
  onUpdatePointerDrag,
  onFinishPointerDrag,
  onCancelPointerDrag,
  onSuppressClickAfterDrag,
  railDropClass,
}: LibraryNotesSectionProps) {
  return (
    <>
      <div className="text-caption group flex items-center justify-between gap-2 px-1 pt-1 font-bold text-foreground/60">
        <span>笔记</span>
        <div className="pointer-events-none flex items-center opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
          <Button
            variant="ghost"
            size="icon-sm"
            surface="transparent"
            className="hover:text-foreground"
            onClick={() => onCreateNoteGroup()}
            title="新建笔记分组"
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
            title={open ? "折叠笔记" : "展开笔记"}
            aria-expanded={open}
          >
            {open ? <ChevronUp /> : <ChevronDown />}
          </Button>
        </div>
      </div>

      {open && (
        <div className="flex flex-col gap-1 overflow-auto">
          {notesGroups.map((group) => {
            const isDefaultGroup = group.id === NOTES_QUICK_GROUP_ID;
            const active = group.id === activeNoteGroupId;
            const GroupIcon = isDefaultGroup ? NotebookPen : getProjectIconOption(group.icon).Icon;
            const iconColor = getProjectIconColor(group.iconColor);
            return (
              <NavigationItem
                key={group.id}
                selected={active}
                active={railActive}
                className={clsx(!isDefaultGroup && "rail-drag-row", !isDefaultGroup && railDropClass("note-group", group.id))}
                data-rail-drag-kind={isDefaultGroup ? undefined : "note-group"}
                data-rail-drag-id={isDefaultGroup ? undefined : group.id}
                data-sheet-move-project-id={NOTES_PROJECT_ID}
                data-sheet-move-group-id={group.id}
                onClick={(event) => {
                  if (onSuppressClickAfterDrag(event)) return;
                  onSelectNoteGroup(group.id);
                }}
                onContextMenu={(event) => onNoteGroupContextMenu(event, group)}
                onPointerDown={(event) => {
                  if (!isDefaultGroup) onStartPointerDrag("note-group", group.id, event);
                }}
                onPointerMove={onUpdatePointerDrag}
                onPointerUp={onFinishPointerDrag}
                onPointerCancel={onCancelPointerDrag}
              >
                <GroupIcon style={active || isDefaultGroup ? undefined : { color: iconColor }} />
                <span className="min-w-0 flex-1 truncate text-left" title={group.title}>
                  {group.title}
                </span>
              </NavigationItem>
            );
          })}
          {notesGroups.length === 0 && (
            <NavigationItem
              selected={QUICK_NOTES_GROUP.id === activeNoteGroupId}
              active={railActive}
              data-sheet-move-project-id={NOTES_PROJECT_ID}
              data-sheet-move-group-id={NOTES_QUICK_GROUP_ID}
              onClick={() => onSelectNoteGroup(QUICK_NOTES_GROUP.id)}
              onContextMenu={(event) => onNoteGroupContextMenu(event, QUICK_NOTES_GROUP)}
            >
              <NotebookPen />
              <span className="min-w-0 flex-1 truncate text-left">随手记</span>
            </NavigationItem>
          )}
        </div>
      )}
    </>
  );
}
