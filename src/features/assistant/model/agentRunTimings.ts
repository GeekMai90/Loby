/**
 * [INPUT]: 依赖 shared AgentRunTimings 契约与 Loby runtime metric 事件
 * [OUTPUT]: 对外提供 AgentRunMetric、applyAgentRunMetric
 * [POS]: AI 助手运行观测模型，把原生阶段事件归并为可随消息持久化、可跨轮比较的耗时快照
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { AgentRunTimings } from "@/shared/types";

export interface AgentRunMetric {
  rawType?: string;
  status?: string;
  elapsedMs?: number;
}

export function applyAgentRunMetric(current: AgentRunTimings, metric: AgentRunMetric): AgentRunTimings {
  const elapsedMs = normalizeElapsedMs(metric.elapsedMs);
  if (elapsedMs === undefined) return current;

  switch (metric.rawType) {
    case "runtime_ready":
      return { ...current, runtimeReadyMs: elapsedMs };
    case "first_text_delta":
      return { ...current, firstTextDeltaMs: elapsedMs };
    case "completed":
      return { ...current, completedMs: elapsedMs };
    default:
      return current;
  }
}

function normalizeElapsedMs(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value) || value < 0) return undefined;
  return Math.round(value);
}
