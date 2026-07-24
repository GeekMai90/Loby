/**
 * [INPUT]: 依赖 React 运行时、lucide-react、clsx、shared 公共契约、运行终态归并、AI 助手模块、shadcn/ui 基础控件
 * [OUTPUT]: 对外提供 AssistantRunPanel，并保证历史终态运行不再显示活动中的子步骤
 * [POS]: AI 助手 feature 的运行时间线视图，消费已归并的用户可读活动而不修改持久化事实
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, CircleCheck, CircleDot, TriangleAlert } from "lucide-react";
import clsx from "clsx";
import type { AgentRunActivity, AgentRunInfo } from "@/shared/types";
import { buildRunSummary } from "@/features/assistant/model/agentRunSummary";
import { buildRunDisplayActivities } from "@/features/assistant/model/agentRunPresentation";
import { settleActivityLines } from "@/features/assistant/model/agentRunState";
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
  const activities = useMemo(
    () => buildRunDisplayActivities(settleActivityLines(run.activities, run.status)),
    [run.activities, run.status],
  );
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
    <div className="mb-2 min-w-0" data-slot="assistant-run-panel">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="max-w-full gap-2.5 border-0 pl-0 text-caption text-muted-foreground hover:bg-transparent hover:text-foreground active:translate-y-0 aria-expanded:bg-transparent aria-expanded:text-muted-foreground aria-expanded:hover:text-foreground dark:border-0 dark:bg-transparent dark:text-[var(--foreground-tertiary)] dark:hover:bg-transparent dark:hover:text-foreground dark:aria-expanded:bg-transparent dark:aria-expanded:text-[var(--foreground-tertiary)] dark:aria-expanded:hover:text-foreground"
        onClick={() => setExpanded((value) => !value)}
        disabled={!hasDetails}
        aria-expanded={hasDetails ? expanded : undefined}
      >
        <span className="grid size-3.5 shrink-0 place-items-center">
          <RunStatusIcon status={run.status} />
        </span>
        <span>{buildRunSummary(run, activities, RUNNING_FALLBACK_LABELS[fallbackIndex])}</span>
        {hasDetails && <ChevronRight className={clsx("transition-transform duration-150", expanded && "rotate-90")} size={14} />}
      </Button>

      {expanded && hasDetails && (
        <div
          className="ml-[6.5px] grid max-w-full min-w-0 gap-0.5 border-l border-[var(--separator)] pl-[16.5px]"
          data-slot="assistant-run-details"
        >
          {activities.map((activity) => (
            <RunActivityItem key={activity.id} activity={activity} />
          ))}
          {run.usage && (
            <code className="mt-1 block max-w-full truncate font-mono text-caption text-muted-foreground transition-colors hover:text-foreground dark:text-[var(--foreground-tertiary)] dark:hover:text-foreground">
              输入 {run.usage.inputTokens.toLocaleString()}，缓存 {run.usage.cachedInputTokens.toLocaleString()}，输出{" "}
              {run.usage.outputTokens.toLocaleString()}，推理 {run.usage.reasoningOutputTokens.toLocaleString()}
            </code>
          )}
          {run.error && <div className="text-caption leading-[1.45] text-destructive">{run.error}</div>}
        </div>
      )}
    </div>
  );
}

function RunActivityItem({ activity }: { activity: AgentRunActivity }) {
  const [expanded, setExpanded] = useState(false);
  const output = trimActivityOutput(activity.output);
  const hasDetails = Boolean(activity.text || activity.command || output);
  const title = activity.title || "运行步骤";

  return (
    <section
      className="group/activity min-w-0 py-1.25 text-muted-foreground dark:text-[var(--foreground-tertiary)]"
      data-slot="assistant-run-activity"
    >
      <div className="grid min-w-0 grid-cols-[14px_minmax(0,1fr)] items-center gap-x-2">
        <span className="grid size-3.5 place-items-center transition-colors group-hover/activity:text-foreground">
          <ActivityStatusIcon activity={activity} />
        </span>
        <div className="flex min-w-0 items-center gap-2 text-caption">
          {hasDetails ? (
            <button
              type="button"
              className="inline-flex min-w-0 max-w-full items-center gap-1 bg-transparent text-left text-inherit outline-none active:translate-y-0 focus-visible:ring-2 focus-visible:ring-ring/40"
              onClick={() => setExpanded((value) => !value)}
              aria-expanded={expanded}
            >
              <span className="truncate font-medium transition-colors group-hover/activity:text-foreground">{title}</span>
              <ChevronRight className={clsx("shrink-0 transition-transform duration-150", expanded && "rotate-90")} size={12} />
            </button>
          ) : (
            <span className="truncate font-medium transition-colors group-hover/activity:text-foreground">{title}</span>
          )}
        </div>
      </div>
      {expanded && hasDetails && (
        <div className="mt-1 ml-5.5 grid min-w-0 gap-1.5">
          {activity.text && (
            <p className="m-0 min-w-0 text-caption leading-[1.45] break-words text-inherit transition-colors group-hover/activity:text-foreground">
              {activity.text}
            </p>
          )}
          {activity.command && (
            <code className="block max-w-full truncate font-mono text-caption text-inherit transition-colors group-hover/activity:text-foreground">
              {activity.command}
            </code>
          )}
          {output && (
            <pre className="m-0 max-h-45 overflow-auto font-mono text-caption leading-[1.45] whitespace-pre-wrap text-inherit transition-colors group-hover/activity:text-foreground">
              {output}
            </pre>
          )}
        </div>
      )}
    </section>
  );
}

function ActivityStatusIcon({ activity }: { activity: AgentRunActivity }) {
  if (activity.status === "in_progress" || activity.status === "running" || activity.status === "active") {
    return <AssistantGridLoader />;
  }
  if (activity.status === "failed" || activity.status === "cancelled" || (activity.exitCode !== null && activity.exitCode !== 0)) {
    return <TriangleAlert size={14} />;
  }
  if (activity.status === "pending") return <CircleDot size={14} />;
  return <CircleCheck size={14} />;
}

function RunStatusIcon({ status }: { status: AgentRunInfo["status"] }) {
  if (status === "running") return <AssistantGridLoader />;
  if (status === "error") return <TriangleAlert size={14} />;
  if (status === "cancelled") return <TriangleAlert size={14} />;
  return <CircleCheck size={14} />;
}

function trimActivityOutput(output: string) {
  const trimmed = output.trim();
  if (!trimmed) return "";
  return trimmed.length > 1200 ? `${trimmed.slice(0, 1200)}...` : trimmed;
}
