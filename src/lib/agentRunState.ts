import type { AgentApprovalRequest, AgentRunActivity } from "../types";

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
