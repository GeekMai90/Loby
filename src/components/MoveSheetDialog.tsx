import { useMemo, useState } from "react";
import { Check, FolderInput, Inbox, NotebookPen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { WritingProject, WritingSheet } from "../types";
import type { SheetMoveTarget } from "../lib/projectCreation";
import {
  DEFAULT_USER_GROUP_ID,
  getVisibleProjectGroups,
  INBOX_GROUP_ID,
  INBOX_PROJECT_ID,
  isInboxProject,
  isNotesProject,
  NOTES_PROJECT_ID,
  NOTES_QUICK_GROUP_ID,
} from "../lib/projectModel";

interface MoveSheetDialogProps {
  open: boolean;
  projects: WritingProject[];
  sheet: WritingSheet;
  sourceProject: WritingProject;
  onClose: () => void;
  onMove: (target: SheetMoveTarget) => void;
}

interface Destination extends SheetMoveTarget {
  id: string;
  label: string;
  section: string;
  icon: "inbox" | "notes" | "project";
}

export function MoveSheetDialog({ open, projects, sheet, sourceProject, onClose, onMove }: MoveSheetDialogProps) {
  const [selectedId, setSelectedId] = useState("");
  const destinations = useMemo(() => createDestinations(projects), [projects]);
  const selected = destinations.find((item) => item.id === selectedId);

  function move() {
    if (!selected) return;
    onMove({ projectId: selected.projectId, groupId: selected.groupId });
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="sm:max-w-120">
        <DialogHeader>
          <DialogTitle>移动文稿</DialogTitle>
          <DialogDescription>将“{sheet.title || "无标题"}”移动到收件箱、随手记或项目分组。</DialogDescription>
        </DialogHeader>
        <div className="max-h-[52vh] space-y-3 overflow-auto pr-1">
          {Array.from(new Set(destinations.map((item) => item.section))).map((section) => (
            <section key={section} className="space-y-1">
              <h3 className="px-1 text-[11px] font-semibold text-muted-foreground">{section}</h3>
              {destinations
                .filter((item) => item.section === section)
                .map((item) => {
                  const current = item.projectId === sourceProject.id && item.groupId === sheet.groupId;
                  const Icon = item.icon === "inbox" ? Inbox : item.icon === "notes" ? NotebookPen : FolderInput;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={current}
                      className={cn(
                        "flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-sm outline-none transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-45",
                        selectedId === item.id && "bg-accent",
                      )}
                      onClick={() => setSelectedId(item.id)}
                    >
                      <Icon size={16} className="text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {current && <small className="text-[11px] text-muted-foreground">当前位置</small>}
                      {selectedId === item.id && <Check size={15} className="text-primary" />}
                    </button>
                  );
                })}
            </section>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button disabled={!selected} onClick={move}>
            移动
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function createDestinations(projects: WritingProject[]): Destination[] {
  const destinations: Destination[] = [
    {
      id: `${INBOX_PROJECT_ID}:${INBOX_GROUP_ID}`,
      projectId: INBOX_PROJECT_ID,
      groupId: INBOX_GROUP_ID,
      label: "收件箱",
      section: "系统",
      icon: "inbox",
    },
  ];
  const notes = projects.find(isNotesProject);
  if (notes) {
    for (const group of getVisibleProjectGroups(notes)) {
      destinations.push({
        id: `${NOTES_PROJECT_ID}:${group.id}`,
        projectId: NOTES_PROJECT_ID,
        groupId: group.id,
        label: group.id === NOTES_QUICK_GROUP_ID ? "笔记／随手记" : `笔记／${group.title}`,
        section: "笔记",
        icon: "notes",
      });
    }
  }
  for (const project of projects.filter((item) => !isNotesProject(item) && !isInboxProject(item))) {
    const groups = getVisibleProjectGroups(project);
    for (const group of groups) {
      destinations.push({
        id: `${project.id}:${group.id}`,
        projectId: project.id,
        groupId: group.id,
        label: group.id === DEFAULT_USER_GROUP_ID ? `${project.title}／待整理` : `${project.title}／${group.title}`,
        section: "项目",
        icon: "project",
      });
    }
  }
  return destinations;
}
