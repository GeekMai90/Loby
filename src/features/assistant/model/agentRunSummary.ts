/**
 * [INPUT]: 依赖 shared AgentRunInfo 的权威 phase/activeActivityId 与已投影活动
 * [OUTPUT]: 对外提供 buildRunSummary，运行中只读取 Runtime phase，旧会话才回退到活动推断
 * [POS]: AI 助手折叠状态投影边界，禁止从事件数组尾部或自由标题猜测当前动作
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { AgentRunActivity, AgentRunInfo } from "@/shared/types";
import { resolveAgentActivityKind, resolveAgentActivityState } from "@/features/assistant/model/agentRunEvents";

export function buildRunSummary(run: AgentRunInfo, activities: AgentRunActivity[], fallbackLabel = "正在处理") {
  const activityCount = activities.length;
  if (run.status === "running") {
    return buildRunningSummary(run, activities, fallbackLabel);
  }
  if (run.status === "cancelled") return activityCount > 0 ? `已取消，${activityCount} 个步骤` : "已取消";
  if (run.status === "error") return activityCount > 0 ? `运行中断，${activityCount} 个步骤` : "运行中断";
  return activityCount > 0 ? `处理完成，${activityCount} 个步骤` : "处理完成";
}

function buildRunningSummary(run: AgentRunInfo, activities: AgentRunActivity[], fallbackLabel: string) {
  if (run.phase) return summarizeRunPhase(run, activities, fallbackLabel);
  const latest = [...activities].reverse().find(isUserFacingActiveActivity);
  if (!latest) return fallbackLabel;
  return summarizeActiveActivity(latest, fallbackLabel);
}

function summarizeRunPhase(run: AgentRunInfo, activities: AgentRunActivity[], fallbackLabel: string) {
  switch (run.phase) {
    case "preparingContext":
      return "正在准备写作上下文";
    case "waitingForModel":
      return "正在等待模型响应";
    case "reasoning":
      return "正在整理思路";
    case "executingTool": {
      const active = activities.find((activity) => activity.id === run.activeActivityId);
      return active ? summarizeActiveActivity(active, "正在调用工具") : "正在调用工具";
    }
    case "waitingForApproval":
      return "等待你确认";
    case "streamingAnswer":
      return "正在生成回复";
    case "finalizing":
      return "正在整理结果";
    case "completed":
      return "处理完成";
    case "failed":
      return "运行中断";
    case "cancelled":
      return "已取消";
    default:
      return fallbackLabel;
  }
}

function summarizeActiveActivity(activity: AgentRunActivity, fallbackLabel: string) {
  const kind = resolveAgentActivityKind(activity);
  const state = resolveAgentActivityState(activity);
  if (state === "awaitingApproval") return "等待你确认";
  switch (kind) {
    case "context":
      return "正在准备写作上下文";
    case "reasoning":
      return "正在整理思路";
    case "modelResponse":
      return "正在生成回复";
    case "imageGeneration":
      return "正在生成图片";
    case "webSearch":
      return "正在搜索资料";
    case "skill":
      return "正在执行 Skill";
    case "approval":
      return "等待你确认";
    case "proposal":
      return "正在准备确认内容";
    case "fileChange":
      return "正在处理文稿修改";
    case "command":
      return activity.command ? `正在运行命令：${compactCommand(activity.command)}` : "正在运行命令";
    case "tool":
      return activity.toolName ? `正在调用 ${activity.toolName}` : "正在调用工具";
    case "status":
    case "unknown":
      return fallbackLabel;
  }
}

function isUserFacingActiveActivity(activity: AgentRunActivity) {
  if (!isActiveActivityStatus(resolveAgentActivityState(activity))) return false;
  if (isBackgroundActivity(activity)) return false;
  return Boolean(activity.title.trim() || activity.command.trim() || activity.rawType.trim());
}

function isActiveActivityStatus(status: string) {
  return status === "running" || status === "awaitingApproval" || status === "queued";
}

function isBackgroundActivity(activity: AgentRunActivity) {
  if (resolveAgentActivityKind(activity) === "status") return true;
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
