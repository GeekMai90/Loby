/**
 * [INPUT]: 依赖 shared 公共契约
 * [OUTPUT]: 对外提供 upsertApprovalRequest、upsertActivityLine
 * [POS]: AI 助手 feature 的领域模型边界，集中 AI 助手 规则、数据转换与外部契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { AgentApprovalRequest, AgentRunActivity } from "@/shared/types";

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
