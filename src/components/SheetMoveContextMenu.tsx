import { Check, Inbox, NotebookPen } from "lucide-react";
import { getProjectIconColor, getProjectIconOption } from "../constants/projectAppearance";
import type { WritingProject } from "../types";
import type { SheetMoveTarget } from "../lib/projectCreation";
import {
  createSheetMoveMenuModel,
  isCurrentSheetMoveTarget,
  type SheetMoveProjectDestination,
  type SheetMoveSourceLocation,
} from "../lib/sheetMoveMenu";
import { ContextMenuItem, ContextMenuSeparator, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger } from "./ui/context-menu";

interface SheetMoveContextMenuProps {
  projects: WritingProject[];
  sources: SheetMoveSourceLocation[];
  onMove: (target: SheetMoveTarget) => void;
  onOpenMore: () => void;
}

export function SheetMoveContextMenu({ projects, sources, onMove, onOpenMore }: SheetMoveContextMenuProps) {
  const model = createSheetMoveMenuModel(projects);
  const count = sources.length;

  return (
    <ContextMenuSub>
      <ContextMenuSubTrigger>{count > 1 ? `移动 ${count} 篇文稿到` : "移动到"}</ContextMenuSubTrigger>
      <ContextMenuSubContent className="max-h-[min(70vh,34rem)] w-52 overflow-y-auto">
        <MoveTargetItem
          icon={<Inbox className="size-4 text-muted-foreground" />}
          label={model.inbox.title}
          current={isCurrentSheetMoveTarget(sources, model.inbox)}
          onSelect={() => onMove(model.inbox)}
        />

        {model.notes && <MoveProjectSubmenu destination={model.notes} sources={sources} onMove={onMove} />}

        {model.projects.length > 0 && <ContextMenuSeparator />}
        {model.projects.map((project) => (
          <MoveProjectSubmenu key={project.projectId} destination={project} sources={sources} onMove={onMove} />
        ))}

        <ContextMenuSeparator />
        <ContextMenuItem onSelect={onOpenMore}>更多位置…</ContextMenuItem>
      </ContextMenuSubContent>
    </ContextMenuSub>
  );
}

interface MoveProjectSubmenuProps {
  destination: SheetMoveProjectDestination;
  sources: SheetMoveSourceLocation[];
  onMove: (target: SheetMoveTarget) => void;
}

function MoveProjectSubmenu({ destination, sources, onMove }: MoveProjectSubmenuProps) {
  const ProjectIcon = destination.kind === "notes" ? NotebookPen : getProjectIconOption(destination.icon).Icon;
  const iconColor = destination.kind === "notes" ? undefined : getProjectIconColor(destination.iconColor);

  return (
    <ContextMenuSub>
      <ContextMenuSubTrigger disabled={destination.groups.length === 0}>
        <ProjectIcon className="size-4 text-muted-foreground" style={iconColor ? { color: iconColor } : undefined} />
        <span className="min-w-0 flex-1 truncate">{destination.title}</span>
      </ContextMenuSubTrigger>
      <ContextMenuSubContent className="max-h-[min(70vh,34rem)] w-44 overflow-y-auto">
        {destination.groups.map((group) => (
          <MoveTargetItem
            key={group.id}
            label={group.title}
            current={isCurrentSheetMoveTarget(sources, group)}
            onSelect={() => onMove(group)}
          />
        ))}
      </ContextMenuSubContent>
    </ContextMenuSub>
  );
}

interface MoveTargetItemProps {
  icon?: React.ReactNode;
  label: string;
  current: boolean;
  onSelect: () => void;
}

function MoveTargetItem({ icon, label, current, onSelect }: MoveTargetItemProps) {
  return (
    <ContextMenuItem disabled={current} onSelect={onSelect}>
      {icon}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {current && (
        <span className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground">
          <Check className="size-3.5" />
          当前位置
        </span>
      )}
    </ContextMenuItem>
  );
}
