import { useEffect, useMemo, useState } from "react";
import { ChevronDown, CircleCheck, Loader2, TriangleAlert } from "lucide-react";
import clsx from "clsx";
import type { AgentRunActivity, AgentRunInfo } from "../types";

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
    }, 2600);
    return () => window.clearInterval(timer);
  }, [run.status]);

  if (!hasDetails && run.status !== "running") return null;

  return (
    <div className={clsx("assistant-run-panel", expanded && "expanded")}>
      <button
        type="button"
        className="assistant-run-summary"
        onClick={() => setExpanded((value) => !value)}
        disabled={!hasDetails}
      >
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

function buildRunSummary(run: AgentRunInfo, activities: AgentRunActivity[], fallbackLabel: string) {
  const activityCount = activities.length;
  if (run.status === "running") {
    return buildRunningSummary(activities, fallbackLabel);
  }
  if (run.status === "cancelled") return activityCount > 0 ? `已取消，${activityCount} 个步骤` : "已取消";
  if (run.status === "error") return activityCount > 0 ? `运行中断，${activityCount} 个步骤` : "运行中断";
  return activityCount > 0 ? `思考完成，${activityCount} 个步骤` : "思考完成";
}

function buildRunningSummary(activities: AgentRunActivity[], fallbackLabel: string) {
  const latest = [...activities].reverse().find((activity) => activity.status !== "completed" && activity.status !== "idle");
  const title = latest?.title.trim();
  if (!latest || !title) return fallbackLabel;

  if (title.includes("命令")) return latest.command ? `正在运行命令：${compactCommand(latest.command)}` : "正在运行命令";
  if (title.includes("工具")) return "正在调用工具";
  if (title.includes("MCP")) return title;
  if (title.includes("文件")) return "正在处理文件";
  if (title.includes("计划")) return "正在更新计划";
  if (title.includes("思考")) return fallbackLabel;
  if (title.includes("配置")) return "正在应用运行配置";
  if (title.includes("会话")) return "正在准备 Codex 会话";
  if (title.includes("状态")) return fallbackLabel;
  return title.startsWith("正在") ? title : `正在${title}`;
}

function compactCommand(command: string) {
  const trimmed = command.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  return trimmed.length > 28 ? `${trimmed.slice(0, 25)}...` : trimmed;
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
