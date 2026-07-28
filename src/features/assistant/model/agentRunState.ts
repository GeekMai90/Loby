/**
 * [INPUT]: 依赖 shared 公共契约
 * [OUTPUT]: 对外提供保持首见顺序且拒绝非 reasoning 终态回退的 approval/activity 归并与父终态封口
 * [POS]: AI 助手 feature 的活动快照归并边界；新 Runtime 生命周期由 agentRunReducer 独占解释，旧会话才从下一动作推断 reasoning 完成
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { AgentApprovalRequest, AgentRunActivity, AgentRunInfo } from "@/shared/types";
import { resolveAgentActivityKind, resolveAgentActivityState } from "@/features/assistant/model/agentRunEvents";

const ACTIVE_ACTIVITY_STATUSES = new Set(["in_progress", "running", "active", "pending", "queued", "awaitingApproval"]);

export function upsertApprovalRequest(requests: AgentApprovalRequest[], next: AgentApprovalRequest): AgentApprovalRequest[] {
  const index = requests.findIndex((request) => request.id === next.id);
  if (index === -1) return [...requests, next];
  return [...requests.slice(0, index), { ...requests[index], ...next }, ...requests.slice(index + 1)];
}

export function upsertActivityLine(lines: AgentRunActivity[], next: AgentRunActivity): AgentRunActivity[] {
  const prepared = settleSupersededActivities(lines, next);
  const index = prepared.findIndex((line) => line.id === next.id);
  if (index === -1) return [...prepared, next];
  const previous = prepared[index];
  if (rejectLifecycleRegression(previous, next)) return prepared;
  const appendOutput = shouldAppendActivityOutput(next.rawType);
  const merged = {
    ...previous,
    ...next,
    title: appendOutput && previous.title ? previous.title : next.title || previous.title,
    kind: next.kind ?? previous.kind,
    state: next.state === "unknown" ? previous.state : (next.state ?? previous.state),
    status: next.status || previous.status,
    toolName: next.toolName || previous.toolName,
    command: next.command || previous.command,
    output: appendOutput ? appendActivityText(previous.output, next.output) : next.output || previous.output,
    text: next.text || previous.text,
    exitCode: next.exitCode ?? previous.exitCode,
    artifactPath: next.artifactPath || previous.artifactPath,
    sequence: next.sequence ?? previous.sequence,
    emittedAtMs: next.emittedAtMs ?? previous.emittedAtMs,
    parentId: next.parentId || previous.parentId,
    visibility: next.visibility ?? previous.visibility,
  };
  return [...prepared.slice(0, index), merged, ...prepared.slice(index + 1)];
}

export function settleActivityLines(lines: AgentRunActivity[], runStatus: AgentRunInfo["status"]): AgentRunActivity[] {
  if (runStatus === "running") return lines;
  const terminalStatus = runStatus === "completed" ? "completed" : runStatus === "error" ? "failed" : "cancelled";
  return lines.map((line) =>
    ACTIVE_ACTIVITY_STATUSES.has(line.state ?? line.status) ? { ...line, state: terminalStatus, status: terminalStatus } : line,
  );
}

function shouldAppendActivityOutput(rawType: string) {
  return (
    rawType.endsWith("/outputDelta") ||
    rawType.endsWith("/progress") ||
    rawType.endsWith("/summaryTextDelta") ||
    rawType.endsWith("/textDelta") ||
    rawType.endsWith("/delta")
  );
}

function appendActivityText(previous: string, next: string) {
  if (!next) return previous;
  if (!previous) return next;
  return `${previous}${next}`;
}

function settleSupersededActivities(lines: AgentRunActivity[], next: AgentRunActivity) {
  if (next.sequence !== undefined) return lines;
  const nextKind = resolveAgentActivityKind(next);
  if (nextKind === "reasoning" || nextKind === "status") return lines;
  return lines.map((line) => {
    if (resolveAgentActivityKind(line) !== "reasoning" || resolveAgentActivityState(line) !== "running") return line;
    return { ...line, state: "completed" as const, status: "completed" };
  });
}

function rejectLifecycleRegression(previous: AgentRunActivity, next: AgentRunActivity) {
  if (resolveAgentActivityKind(previous) === "reasoning") return false;
  const previousState = resolveAgentActivityState(previous);
  const nextState = resolveAgentActivityState(next);
  return isTerminalActivityState(previousState) && previousState !== nextState;
}

function isTerminalActivityState(state: string) {
  return state === "completed" || state === "failed" || state === "cancelled";
}
