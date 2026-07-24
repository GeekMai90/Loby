/**
 * [INPUT]: 依赖 shared 公共契约
 * [OUTPUT]: 对外提供 upsertApprovalRequest、upsertActivityLine、settleActivityLines
 * [POS]: AI 助手 feature 的运行状态归并边界，统一活动增量合并与父子终态收口
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { AgentApprovalRequest, AgentRunActivity, AgentRunInfo } from "@/shared/types";

const ACTIVE_ACTIVITY_STATUSES = new Set(["in_progress", "running", "active", "pending"]);

export function upsertApprovalRequest(requests: AgentApprovalRequest[], next: AgentApprovalRequest): AgentApprovalRequest[] {
  const index = requests.findIndex((request) => request.id === next.id);
  if (index === -1) return [...requests, next];
  return [...requests.slice(0, index), { ...requests[index], ...next }, ...requests.slice(index + 1)];
}

export function upsertActivityLine(lines: AgentRunActivity[], next: AgentRunActivity): AgentRunActivity[] {
  const index = lines.findIndex((line) => line.id === next.id);
  if (index === -1) return [...lines, next];
  const previous = lines[index];
  const appendOutput = shouldAppendActivityOutput(next.rawType);
  const merged = {
    ...previous,
    ...next,
    title: appendOutput && previous.title ? previous.title : next.title || previous.title,
    status: next.status || previous.status,
    command: next.command || previous.command,
    output: appendOutput ? appendActivityText(previous.output, next.output) : next.output || previous.output,
    text: next.text || previous.text,
    exitCode: next.exitCode ?? previous.exitCode,
    artifactPath: next.artifactPath || previous.artifactPath,
  };
  return [...lines.slice(0, index), merged, ...lines.slice(index + 1)];
}

export function settleActivityLines(lines: AgentRunActivity[], runStatus: AgentRunInfo["status"]): AgentRunActivity[] {
  if (runStatus === "running") return lines;
  const terminalStatus = runStatus === "completed" ? "completed" : runStatus === "error" ? "failed" : "cancelled";
  return lines.map((line) => (ACTIVE_ACTIVITY_STATUSES.has(line.status) ? { ...line, status: terminalStatus } : line));
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
