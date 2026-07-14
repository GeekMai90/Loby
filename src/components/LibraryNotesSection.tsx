import { ChevronDown, ChevronUp, Inbox, Plus } from "lucide-react";
import clsx from "clsx";
import type { MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import { getProjectIconColor, getProjectIconOption } from "../constants/projectAppearance";
import type { ProjectGroup } from "../types";
import type { RailDragHandlers } from "./LibraryRailTypes";
import { NavigationItem } from "./NavigationItem";

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

const INBOX_GROUP: ProjectGroup = {
  id: "notes-inbox",
  title: "收件箱",
  icon: "inbox",
  iconColor: "#8e8e93",
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
      <div className="group flex items-center justify-between gap-2 px-1 pt-1 text-[11px] font-bold text-foreground/60">
        <span>笔记</span>
        <div className="pointer-events-none flex items-center opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
          <Button variant="ghost" size="icon-sm" onClick={() => onCreateNoteGroup()} title="新建笔记分组">
            <Plus />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
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
            const isInbox = group.id === "notes-inbox";
            const active = group.id === activeNoteGroupId;
            const GroupIcon = isInbox ? Inbox : getProjectIconOption(group.icon).Icon;
            const iconColor = getProjectIconColor(group.iconColor);
            return (
              <NavigationItem
                key={group.id}
                selected={active}
                active={railActive}
                className={clsx(!isInbox && "rail-drag-row", !isInbox && railDropClass("note-group", group.id))}
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
                <GroupIcon size={16} style={active || isInbox ? undefined : { color: iconColor }} />
                <span>{group.title}</span>
              </NavigationItem>
            );
          })}
          {notesGroups.length === 0 && (
            <NavigationItem
              selected={INBOX_GROUP.id === activeNoteGroupId}
              active={railActive}
              onClick={() => onSelectNoteGroup(INBOX_GROUP.id)}
              onContextMenu={(event) => onNoteGroupContextMenu(event, INBOX_GROUP)}
            >
              <Inbox size={16} />
              <span>收件箱</span>
            </NavigationItem>
          )}
        </div>
      )}
    </>
  );
}
