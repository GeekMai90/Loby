/**
 * [INPUT]: 依赖 Loby Agent Runtime 的稳定 activity 契约
 * [OUTPUT]: 对外提供 buildRunDisplayActivities，按 visibility 筛掉诊断事件、折叠旧 reasoning、清理历史英文/Markdown 摘要并生成完整文案
 * [POS]: AI 助手 feature 的用户轨迹投影边界；权威 phase 不在这里计算，旧会话的标题和摘要兼容止于此处
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { AgentRunActivity } from "@/shared/types";
import {
  resolveAgentActivityKind,
  resolveAgentActivityState,
  resolveAgentActivityVisibility,
} from "@/features/assistant/model/agentRunEvents";

export function buildRunDisplayActivities(activities: AgentRunActivity[]): AgentRunActivity[] {
  const visible = activities.map(presentActivity).filter(isVisibleActivity);
  const merged = visible.reduce<AgentRunActivity[]>((result, activity) => {
    const previousIndex = result.findIndex(
      (previous) => previous.id === activity.id || (previous.kind === "reasoning" && activity.kind === "reasoning"),
    );
    if (previousIndex === -1) return [...result, activity];
    return [...result.slice(0, previousIndex), ...result.slice(previousIndex + 1), mergeActivity(result[previousIndex], activity)];
  }, []);
  return merged;
}

function presentActivity(activity: AgentRunActivity): AgentRunActivity {
  const kind = resolveAgentActivityKind(activity);
  const state = resolveAgentActivityState(activity);
  const reasoning = kind === "reasoning";
  const toolName = activity.toolName || legacyToolName(activity.title);
  const normalized = { ...activity, kind, state, toolName };
  return {
    ...normalized,
    title: activityTitle(normalized, kind, state),
    text: reasoning ? presentReasoningText(activity.text || activity.output) : activity.text,
    output: reasoning && !activity.text ? "" : activity.output,
  };
}

function presentReasoningText(text: string) {
  const lines = text
    .replace(/\*{4}/g, "\n")
    .replace(/\*{2}|__|`/g, "")
    .split(/\r?\n/)
    .map((line) =>
      line
        .trim()
        .replace(/^(?:#+|>|[-*]\s+)\s*/, "")
        .trim(),
    )
    .filter((line) => /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/u.test(line));
  if (lines.length > 0) return lines.join("\n");
  return text.trim() ? "模型正在分析任务并规划下一步操作。" : "";
}

function legacyToolName(title: string) {
  const prefix = title.trim().match(/^(?:准备调用|调用|完成)\s+(.+)$/);
  if (prefix) return prefix[1].trim();
  return (
    title
      .trim()
      .match(/^(.+?)\s+调用失败$/)?.[1]
      ?.trim() || ""
  );
}

function activityTitle(
  activity: AgentRunActivity,
  kind: NonNullable<AgentRunActivity["kind"]>,
  state: NonNullable<AgentRunActivity["state"]>,
) {
  switch (kind) {
    case "context":
      return lifecycleTitle(state, "准备写作上下文", "写作上下文已准备", "写作上下文准备失败", "已取消准备写作上下文");
    case "reasoning":
      return lifecycleTitle(state, "整理思路", "思路已整理", "思路整理失败", "已取消整理思路");
    case "modelResponse":
      return lifecycleTitle(state, "生成回复", "回复已生成", "回复生成失败", "已取消生成回复");
    case "imageGeneration":
      return lifecycleTitle(state, "生成图片", "图片已生成", "图片生成失败", "已取消生成图片");
    case "webSearch":
      return lifecycleTitle(state, "搜索资料", "资料搜索完成", "资料搜索失败", "已取消搜索资料");
    case "skill":
      return lifecycleTitle(state, "执行 Skill", "Skill 执行完成", "Skill 执行失败", "已取消执行 Skill");
    case "approval":
      return state === "awaitingApproval" ? "等待确认" : lifecycleTitle(state, "处理确认", "确认已处理", "确认处理失败", "已取消确认");
    case "proposal":
      return lifecycleTitle(state, "准备确认内容", "确认内容已生成", "确认内容生成失败", "已取消准备确认内容");
    case "fileChange":
      return lifecycleTitle(state, "处理文稿修改", "文稿修改已准备", "文稿修改失败", "已取消文稿修改");
    case "command":
      return lifecycleTitle(state, "运行命令", "命令执行完成", "命令执行失败", "已取消运行命令");
    case "tool": {
      const toolName = activity.toolName?.trim();
      if (!toolName) return lifecycleTitle(state, "调用工具", "工具调用完成", "工具调用失败", "已取消调用工具");
      return lifecycleTitle(state, `调用 ${toolName}`, `${toolName} 调用完成`, `${toolName} 调用失败`, `已取消调用 ${toolName}`);
    }
    case "status":
    case "unknown":
      return activity.title || "运行步骤";
  }
}

function lifecycleTitle(
  state: NonNullable<AgentRunActivity["state"]>,
  running: string,
  completed: string,
  failed: string,
  cancelled: string,
) {
  if (state === "completed") return completed;
  if (state === "failed") return failed;
  if (state === "cancelled") return cancelled;
  return running;
}

function isVisibleActivity(activity: AgentRunActivity) {
  if (resolveAgentActivityVisibility(activity) === "diagnostic") return false;
  if (resolveAgentActivityKind(activity) === "approval" && resolveAgentActivityState(activity) !== "awaitingApproval") return false;
  return Boolean(
    activity.title.trim() || activity.text.trim() || activity.output.trim() || activity.artifactPath || activity.state === "failed",
  );
}

function mergeActivity(previous: AgentRunActivity, current: AgentRunActivity): AgentRunActivity {
  return {
    ...previous,
    ...current,
    title: current.title || previous.title,
    kind: current.kind ?? previous.kind,
    state: current.state === "unknown" ? previous.state : (current.state ?? previous.state),
    status: current.status || previous.status,
    toolName: current.toolName || previous.toolName,
    command: current.command || previous.command,
    output: current.output || previous.output,
    text: current.text || previous.text,
    artifactPath: current.artifactPath || previous.artifactPath,
    exitCode: current.exitCode ?? previous.exitCode,
    sequence: current.sequence ?? previous.sequence,
    emittedAtMs: current.emittedAtMs ?? previous.emittedAtMs,
    parentId: current.parentId || previous.parentId,
    visibility: current.visibility ?? previous.visibility,
  };
}
