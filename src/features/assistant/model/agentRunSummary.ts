/**
 * [INPUT]: 依赖 shared 公共契约
 * [OUTPUT]: 对外提供 buildRunSummary
 * [POS]: AI 助手 feature 的领域模型边界，集中 AI 助手 规则、数据转换与外部契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { AgentRunActivity, AgentRunInfo } from "@/shared/types";

export function buildRunSummary(run: AgentRunInfo, activities: AgentRunActivity[], fallbackLabel: string) {
  const activityCount = activities.length;
  if (run.status === "running") {
    return buildRunningSummary(activities, fallbackLabel);
  }
  if (run.status === "cancelled") return activityCount > 0 ? `已取消，${activityCount} 个步骤` : "已取消";
  if (run.status === "error") return activityCount > 0 ? `运行中断，${activityCount} 个步骤` : "运行中断";
  return activityCount > 0 ? `处理完成，${activityCount} 个步骤` : "处理完成";
}

function buildRunningSummary(activities: AgentRunActivity[], fallbackLabel: string) {
  const latest = [...activities].reverse().find(isUserFacingActiveActivity);
  if (!latest) return fallbackLabel;
  return summarizeActiveActivity(latest, fallbackLabel);
}

function summarizeActiveActivity(activity: AgentRunActivity, fallbackLabel: string) {
  const title = activity.title.trim();
  const rawType = activity.rawType.trim();

  if (activity.status === "pending" || rawType.includes("requestApproval") || title.includes("需要")) {
    return "等待你确认";
  }
  if (rawType.includes("agentMessage") || title.includes("生成回复")) return "正在生成回复";
  if (rawType.includes("commandExecution") || title.includes("命令")) {
    return activity.command ? `正在运行命令：${compactCommand(activity.command)}` : "正在运行命令";
  }
  if (rawType.includes("mcpToolCall") || title.includes("工具")) return "正在调用工具";
  if (rawType.includes("fileChange") || title.includes("文件")) return "正在处理文件修改";
  if (rawType.includes("plan") || title.includes("计划")) return "正在更新计划";
  if (rawType.includes("reasoning") || title.includes("思考")) return "正在思考";
  if (!title) return fallbackLabel;
  return title.startsWith("正在") ? title : `正在${title}`;
}

function isUserFacingActiveActivity(activity: AgentRunActivity) {
  if (!isActiveActivityStatus(activity.status)) return false;
  if (isBackgroundActivity(activity)) return false;
  return Boolean(activity.title.trim() || activity.command.trim() || activity.rawType.trim());
}

function isActiveActivityStatus(status: string) {
  return status === "in_progress" || status === "running" || status === "active" || status === "pending";
}

function isBackgroundActivity(activity: AgentRunActivity) {
  const title = activity.title.trim();
  const rawType = activity.rawType.trim();
  if (!title && !rawType) return true;
  if (title.includes("Agent 正在运行") || title.includes("Agent 空闲")) return true;
  if (title.includes("开始处理")) return true;
  if (title.includes("运行配置")) return true;
  if (title.includes("启动失败")) return true;
  if (title.includes("提示")) return true;
  return false;
}

function compactCommand(command: string) {
  const trimmed = command.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  return trimmed.length > 28 ? `${trimmed.slice(0, 25)}...` : trimmed;
}
