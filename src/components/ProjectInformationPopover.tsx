import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { getProjectInformation } from "../lib/projectInformation";
import type { WritingProject } from "../types";

export function ProjectInformationPopover({ project }: { project: WritingProject }) {
  const information = getProjectInformation(project);
  const projectGoalUnit = information.projectGoal.unit === "articles" ? "篇" : "字";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-foreground"
          title="项目信息"
          aria-label="项目信息"
        >
          <Info size={14} />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="right" align="start" sideOffset={10} className="w-72 p-4">
        <div className="mb-3 min-w-0">
          <p className="truncate text-sm font-semibold" title={project.title}>
            {project.title}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">项目概览</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Metric label="文章数" value={`${formatNumber(information.articleCount)} 篇`} />
          <Metric label="项目总字数" value={`${formatNumber(information.totalWords)} 字`} />
        </div>

        <div className="mt-4 space-y-4 border-t border-border pt-4">
          <GoalSection
            title="项目目标"
            enabled={information.projectGoal.enabled}
            progress={information.projectGoal.progress}
            value={
              information.projectGoal.enabled
                ? `${formatNumber(information.projectGoal.current)} / ${formatNumber(information.projectGoal.target)} ${projectGoalUnit}`
                : "尚未设置"
            }
          />
          <GoalSection
            title="文章目标"
            enabled={information.articleGoal.enabled}
            progress={information.articleGoal.progress}
            value={
              information.articleGoal.enabled
                ? `每篇 ${formatNumber(information.articleGoal.targetWords)} 字 · 已达标 ${formatNumber(information.articleGoal.achievedCount)} / ${formatNumber(information.articleCount)} 篇`
                : "尚未设置"
            }
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/60 px-3 py-2.5">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <strong className="mt-1 block text-sm font-semibold tabular-nums">{value}</strong>
    </div>
  );
}

function GoalSection({ title, enabled, progress, value }: { title: string; enabled: boolean; progress: number; value: string }) {
  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium">{title}</span>
        {enabled && <strong className="text-xs font-semibold text-primary tabular-nums">{progress}%</strong>}
      </div>
      {enabled && <Progress className="mt-2" value={progress} />}
      <p className="mt-1.5 text-[11px] leading-4 text-muted-foreground tabular-nums">{value}</p>
    </section>
  );
}

function formatNumber(value: number): string {
  return value.toLocaleString("zh-CN");
}
