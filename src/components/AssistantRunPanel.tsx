import { useEffect, useMemo, useState } from "react";
import { ChevronDown, CircleCheck, Loader2, TriangleAlert } from "lucide-react";
import clsx from "clsx";
import type { AgentRunActivity, AgentRunInfo } from "../types";
import { buildRunSummary } from "../lib/agentRunSummary";

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
    () => run.activities.filter((activity) => activity.title || activity.command || activity.output || activity.text),
    [run.activities],
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
    <div className={clsx("assistant-run-panel", expanded && "expanded")}>
      <button type="button" className="assistant-run-summary" onClick={() => setExpanded((value) => !value)} disabled={!hasDetails}>
        <RunStatusIcon status={run.status} />
        <span>{buildRunSummary(run, activities, RUNNING_FALLBACK_LABELS[fallbackIndex])}</span>
        {hasDetails && <ChevronDown className="assistant-run-chevron" size={14} />}
      </button>

      {expanded && hasDetails && (
        <div className="assistant-run-details">
          {activities.map((activity) => (
            <RunActivityItem key={activity.id} activity={activity} />
          ))}
          {run.usage && (
            <div className="assistant-run-usage">
              <span>用量</span>
              <code>
                输入 {run.usage.inputTokens.toLocaleString()}，缓存 {run.usage.cachedInputTokens.toLocaleString()}，输出{" "}
                {run.usage.outputTokens.toLocaleString()}，推理 {run.usage.reasoningOutputTokens.toLocaleString()}
              </code>
            </div>
          )}
          {run.error && <div className="assistant-run-error">{run.error}</div>}
        </div>
      )}
    </div>
  );
}

function RunActivityItem({ activity }: { activity: AgentRunActivity }) {
  const status = formatActivityStatus(activity.status, activity.exitCode);
  const output = trimActivityOutput(activity.output);

  return (
    <section className="assistant-run-item">
      <div className="assistant-run-item-header">
        <span>{activity.title || "运行步骤"}</span>
        {status && <small>{status}</small>}
      </div>
      {activity.command && <code className="assistant-run-command">{activity.command}</code>}
      {activity.text && <p>{activity.text}</p>}
      {output && <pre>{output}</pre>}
    </section>
  );
}

function RunStatusIcon({ status }: { status: AgentRunInfo["status"] }) {
  if (status === "running") return <Loader2 className="assistant-run-spinner" size={14} />;
  if (status === "error") return <TriangleAlert size={14} />;
  if (status === "cancelled") return <TriangleAlert size={14} />;
  return <CircleCheck size={14} />;
}

function formatActivityStatus(status: string, exitCode: number | null) {
  if (exitCode !== null) return exitCode === 0 ? "完成" : `退出码 ${exitCode}`;
  if (status === "in_progress") return "进行中";
  if (status === "pending") return "待确认";
  if (status === "accept") return "已允许";
  if (status === "acceptForSession") return "本次允许";
  if (status === "decline") return "已拒绝";
  if (status === "cancel") return "已取消";
  if (status === "completed" || status === "item.completed") return "完成";
  if (status === "idle") return "空闲";
  if (status === "active") return "运行中";
  return status;
}

function trimActivityOutput(output: string) {
  const trimmed = output.trim();
  if (!trimmed) return "";
  return trimmed.length > 1200 ? `${trimmed.slice(0, 1200)}...` : trimmed;
}
