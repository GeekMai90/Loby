/**
 * [INPUT]: 依赖 React 运行时、lucide-react、clsx、shared 公共契约、AI 助手模块、shadcn/ui 基础控件
 * [OUTPUT]: 对外提供 AssistantRunPanel
 * [POS]: AI 助手 feature 的界面组合单元，连接 AI 助手状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, CircleCheck, CircleDot, TriangleAlert } from "lucide-react";
import clsx from "clsx";
import type { AgentRunActivity, AgentRunInfo } from "@/shared/types";
import { buildRunSummary } from "@/features/assistant/model/agentRunSummary";
import { buildRunDisplayActivities } from "@/features/assistant/model/agentRunPresentation";
import { Button } from "@/components/ui/button";
import { AssistantGridLoader } from "@/features/assistant/components/AssistantGridLoader";

interface AssistantRunPanelProps {
  run: AgentRunInfo;
}

const RUNNING_FALLBACK_LABELS = [
  "正在想办法",
  "正在整理思路",
  "正在认真处理",
  "稍等我一下",
  "我再确认一下",
  "正在补全细节",
  "快整理好了",
  "别急别急",
];
const RUNNING_FALLBACK_ROTATION_MS = 7000;

export function AssistantRunPanel({ run }: AssistantRunPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [fallbackIndex, setFallbackIndex] = useState(0);
  const activities = useMemo(() => buildRunDisplayActivities(run.activities), [run.activities]);
  const hasDetails = activities.length > 0 || run.usage || run.error;

  useEffect(() => {
    if (run.status !== "running") return;
    const timer = window.setInterval(() => {
      setFallbackIndex((index) => (index + 1) % RUNNING_FALLBACK_LABELS.length);
    }, RUNNING_FALLBACK_ROTATION_MS);
    return () => window.clearInterval(timer);
  }, [run.status]);

  if (!hasDetails && run.status !== "running") return null;

  return (
    <div className="mb-2 min-w-0">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="max-w-full gap-2.5"
        onClick={() => setExpanded((value) => !value)}
        disabled={!hasDetails}
      >
        <RunStatusIcon status={run.status} />
        <span>{buildRunSummary(run, activities, RUNNING_FALLBACK_LABELS[fallbackIndex])}</span>
        {hasDetails && <ChevronDown className={clsx("transition-transform duration-150", expanded && "rotate-180")} size={14} />}
      </Button>

      {expanded && hasDetails && (
        <div className="mt-2 grid w-full max-w-full min-w-0 gap-1 overflow-hidden rounded-lg border border-border bg-muted/30 p-2.5">
          {activities.map((activity) => (
            <RunActivityItem key={activity.id} activity={activity} />
          ))}
          {run.usage && (
            <code className="mt-1 block max-w-full truncate border-t border-border/70 px-1.5 pt-2 font-mono text-[11px] text-muted-foreground">
              输入 {run.usage.inputTokens.toLocaleString()}，缓存 {run.usage.cachedInputTokens.toLocaleString()}，输出{" "}
              {run.usage.outputTokens.toLocaleString()}，推理 {run.usage.reasoningOutputTokens.toLocaleString()}
            </code>
          )}
          {run.error && <div className="rounded-lg bg-destructive/10 p-1.75 text-xs leading-[1.45] text-destructive">{run.error}</div>}
        </div>
      )}
    </div>
  );
}

function RunActivityItem({ activity }: { activity: AgentRunActivity }) {
  const status = formatActivityStatus(activity.status, activity.exitCode);
  const output = trimActivityOutput(activity.output);

  return (
    <section className="flex min-w-0 items-start gap-2 rounded-md px-1.5 py-1.25">
      <ActivityStatusIcon activity={activity} />
      <div className="grid min-w-0 flex-1 gap-0.5">
        <div className="flex min-w-0 items-center justify-between gap-2 text-xs">
          <span className="truncate font-medium">{activity.title || "运行步骤"}</span>
          {status && <small className="shrink-0 text-[11px] text-muted-foreground">{status}</small>}
        </div>
        {activity.text && <p className="m-0 min-w-0 text-xs leading-[1.45] break-words text-muted-foreground">{activity.text}</p>}
        {activity.command && (
          <code className="block max-w-full truncate rounded bg-card px-1.5 py-1 font-mono text-[11px] text-muted-foreground">
            {activity.command}
          </code>
        )}
        {output && (
          <pre className="m-0 max-h-45 overflow-auto rounded bg-card p-1.5 font-mono text-[11px] leading-[1.45] whitespace-pre-wrap text-muted-foreground">
            {output}
          </pre>
        )}
      </div>
    </section>
  );
}

function ActivityStatusIcon({ activity }: { activity: AgentRunActivity }) {
  if (activity.status === "in_progress" || activity.status === "running" || activity.status === "active") {
    return <AssistantGridLoader className="mt-0.5 shrink-0" />;
  }
  if (activity.status === "failed" || (activity.exitCode !== null && activity.exitCode !== 0)) {
    return <TriangleAlert className="mt-0.25 shrink-0 text-destructive" size={14} />;
  }
  if (activity.status === "pending") return <CircleDot className="mt-0.25 shrink-0 text-muted-foreground" size={14} />;
  return <CircleCheck className="mt-0.25 shrink-0 text-muted-foreground" size={14} />;
}

function RunStatusIcon({ status }: { status: AgentRunInfo["status"] }) {
  if (status === "running") return <AssistantGridLoader />;
  if (status === "error") return <TriangleAlert size={14} />;
  if (status === "cancelled") return <TriangleAlert size={14} />;
  return <CircleCheck size={14} />;
}

function formatActivityStatus(status: string, exitCode: number | null) {
  if (exitCode !== null) return exitCode === 0 ? "完成" : `退出码 ${exitCode}`;
  if (status === "in_progress" || status === "running" || status === "active") return "进行中";
  if (status === "pending") return "待确认";
  if (status === "accept") return "已允许";
  if (status === "acceptForSession") return "本次允许";
  if (status === "decline") return "已拒绝";
  if (status === "cancel") return "已取消";
  if (status === "completed" || status === "item.completed") return "完成";
  if (status === "failed") return "失败";
  if (status === "success") return "完成";
  if (status === "idle") return "空闲";
  return status;
}

function trimActivityOutput(output: string) {
  const trimmed = output.trim();
  if (!trimmed) return "";
  return trimmed.length > 1200 ? `${trimmed.slice(0, 1200)}...` : trimmed;
}
