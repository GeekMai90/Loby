/**
 * [INPUT]: 依赖 React 运行时、lucide-react、shadcn/ui 基础控件、shared 公共契约、写作库模块
 * [OUTPUT]: 对外提供 MoveSheetDialogEntry、MoveSheetDialog
 * [POS]: 写作库 feature 的界面组合单元，连接 写作库 状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useMemo, useState } from "react";
import { Check, FolderInput, Inbox, NotebookPen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/shared/lib/utils";
import type { WritingProject, WritingSheet } from "@/shared/types";
import type { SheetMoveTarget } from "@/features/library/model/projectCreation";
import { createSheetMoveMenuModel, isCurrentSheetMoveTarget, type SheetMoveSourceLocation } from "@/features/library/model/sheetMoveMenu";

export interface MoveSheetDialogEntry {
  project: WritingProject;
  sheet: WritingSheet;
}

interface MoveSheetDialogProps {
  open: boolean;
  projects: WritingProject[];
  entries: MoveSheetDialogEntry[];
  onClose: () => void;
  onMove: (target: SheetMoveTarget) => void;
}

interface Destination extends SheetMoveTarget {
  id: string;
  label: string;
  section: string;
  icon: "inbox" | "notes" | "project";
}

export function MoveSheetDialog({ open, projects, entries, onClose, onMove }: MoveSheetDialogProps) {
  const [selectedId, setSelectedId] = useState("");
  const destinations = useMemo(() => createDestinations(projects), [projects]);
  const selected = destinations.find((item) => item.id === selectedId);
  const sources: SheetMoveSourceLocation[] = entries.map(({ project, sheet }) => ({ projectId: project.id, groupId: sheet.groupId }));
  const firstSheet = entries[0]?.sheet;

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
          <DialogDescription>
            {entries.length > 1
              ? `将 ${entries.length} 篇文稿移动到收件箱、随手记或项目分组。`
              : `将“${firstSheet?.title || "无标题"}”移动到收件箱、随手记或项目分组。`}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[52vh] space-y-3 overflow-auto pr-1">
          {Array.from(new Set(destinations.map((item) => item.section))).map((section) => (
            <section key={section} className="space-y-1">
              <h3 className="px-1 text-[11px] font-semibold text-muted-foreground">{section}</h3>
              {destinations
                .filter((item) => item.section === section)
                .map((item) => {
                  const current = isCurrentSheetMoveTarget(sources, item);
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
  const model = createSheetMoveMenuModel(projects);
  return [
    { ...model.inbox, label: model.inbox.title, section: "系统", icon: "inbox" },
    ...(model.notes?.groups.map((group) => ({
      ...group,
      label: `笔记／${group.title}`,
      section: "笔记",
      icon: "notes" as const,
    })) ?? []),
    ...model.projects.flatMap((project) =>
      project.groups.map((group) => ({
        ...group,
        label: `${project.title}／${group.title}`,
        section: "项目",
        icon: "project" as const,
      })),
    ),
  ];
}
