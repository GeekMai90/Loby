import { ChevronDown, ChevronUp, Inbox, Plus } from "lucide-react";
import clsx from "clsx";
import type { MouseEvent } from "react";
import { getProjectIconColor, getProjectIconOption } from "../constants/projectAppearance";
import type { ProjectGroup } from "../types";
import type { RailDragHandlers } from "./LibraryRailTypes";

interface LibraryNotesSectionProps extends RailDragHandlers {
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
      <div className="rail-header library-projects-header">
        <span>笔记</span>
        <div className="section-header-actions">
          <button className="icon-button section-action-button" onClick={() => onCreateNoteGroup()} title="新建笔记分组">
            <Plus size={15} />
          </button>
          <button
            className="icon-button section-action-button"
            onClick={(event) => {
              onToggleOpen();
              event.currentTarget.blur();
            }}
            title={open ? "折叠笔记" : "展开笔记"}
            aria-expanded={open}
          >
            {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="project-list">
          {notesGroups.map((group) => {
            const isInbox = group.id === "notes-inbox";
            const GroupIcon = isInbox ? Inbox : getProjectIconOption(group.icon).Icon;
            const iconColor = isInbox ? "#8e8e93" : getProjectIconColor(group.iconColor);
            return (
              <button
                key={group.id}
                className={clsx(
                  "nav-item note-nav-item",
                  group.id === activeNoteGroupId && "active",
                  !isInbox && railDropClass("note-group", group.id),
                )}
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
                <GroupIcon size={16} style={{ color: iconColor }} />
                <span>{group.title}</span>
              </button>
            );
          })}
          {notesGroups.length === 0 && (
            <button
              className="nav-item note-nav-item"
              onClick={() => onSelectNoteGroup(INBOX_GROUP.id)}
              onContextMenu={(event) => onNoteGroupContextMenu(event, INBOX_GROUP)}
            >
              <Inbox size={16} style={{ color: "#8e8e93" }} />
              <span>收件箱</span>
            </button>
          )}
        </div>
      )}
    </>
  );
}
