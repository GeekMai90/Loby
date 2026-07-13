import { FilePlus2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { PublishingChecklistItem, WritingSheet } from "../types";
import type { ExportReadinessItem } from "./ExportPanelTypes";

interface ExportPublishingSectionProps {
  selectedSheets: WritingSheet[];
  readinessChecklist: ExportReadinessItem[];
  publishingChecklist: PublishingChecklistItem[];
  finishedPublishingTasks: number;
  onTogglePublishingChecklistItem: (itemId: string) => void;
  onCreatePublishVersion: () => void;
}

export function ExportPublishingSection({
  selectedSheets,
  readinessChecklist,
  publishingChecklist,
  finishedPublishingTasks,
  onTogglePublishingChecklistItem,
  onCreatePublishVersion,
}: ExportPublishingSectionProps) {
  return (
    <section className="rounded-lg border border-border bg-card p-3">
      <h2 className="mb-3 text-sm font-semibold">发布检查</h2>
      <div className="mb-3 flex flex-col gap-1.5">
        {readinessChecklist.map((item) => (
          <div
            key={item.label}
            className="grid min-h-7.5 grid-cols-[22px_minmax(0,1fr)] items-center rounded-lg border border-border bg-muted/40 px-2 py-1.5"
          >
            <span
              className={cn(
                "grid size-4.5 place-items-center rounded-full bg-card text-[11px] font-extrabold text-muted-foreground",
                item.ok && "bg-emerald-600 text-white",
              )}
            >
              {item.ok ? "✓" : "!"}
            </span>
            <strong className="truncate text-xs">{item.label}</strong>
          </div>
        ))}
      </div>
      <div className="mt-3.5 mb-1.5 flex items-center justify-between">
        <strong className="text-xs">发布任务</strong>
        <small className="text-xs text-muted-foreground">
          {finishedPublishingTasks} / {publishingChecklist.length}
        </small>
      </div>
      <div className="mb-3 flex flex-col gap-1.5">
        {publishingChecklist.map((item) => (
          <label
            key={item.id}
            className="grid min-h-7.5 grid-cols-[18px_minmax(0,1fr)] items-center rounded-lg border border-border bg-card px-2 py-1.5 text-xs hover:bg-accent"
          >
            <Checkbox checked={item.done} onCheckedChange={() => onTogglePublishingChecklistItem(item.id)} />
            <span className={cn("truncate", item.done && "text-muted-foreground line-through")}>{item.label}</span>
          </label>
        ))}
      </div>
      <Button className="w-full" onClick={onCreatePublishVersion} disabled={selectedSheets.length === 0}>
        <FilePlus2 /> 保存为发布版本
      </Button>
    </section>
  );
}
