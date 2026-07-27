/**
 * [INPUT]: 依赖 native AgentChatStreamEvent 与 shared AgentRunInfo 稳定契约
 * [OUTPUT]: 对外提供 createAgentRun、reduceAgentRunEvent、setAgentRunPhase、normalizePersistedAgentRun，统一实时与恢复期不变量
 * [POS]: AI 助手运行状态的唯一 renderer reducer；实时消息与历史快照共享同一 phase/activity 不变量
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { AgentChatStreamEvent } from "@/features/assistant/model/agentRuntime";
import { activityFromAgentEvent } from "@/features/assistant/model/agentRunEvents";
import { settleActivityLines, upsertActivityLine } from "@/features/assistant/model/agentRunState";
import type { AgentRunInfo, AgentRunPhase } from "@/shared/types";

export function createAgentRun(phase: AgentRunPhase = "preparingContext"): AgentRunInfo {
  return {
    schemaVersion: 2,
    status: "running",
    phase,
    activities: [],
    usage: null,
  };
}

export function setAgentRunPhase(run: AgentRunInfo, phase: AgentRunPhase, activeActivityId?: string): AgentRunInfo {
  return {
    ...run,
    schemaVersion: 2,
    phase,
    activeActivityId: activeActivityId || undefined,
  };
}

export function reduceAgentRunEvent(run: AgentRunInfo, event: AgentChatStreamEvent): AgentRunInfo {
  if (event.sequence && run.lastSequence && event.sequence <= run.lastSequence) return run;
  const next: AgentRunInfo = {
    ...run,
    schemaVersion: 2,
    lastSequence: event.sequence || run.lastSequence,
  };

  if (event.kind === "started") return { ...next, status: "running" };
  if (event.kind === "state" && event.runPhase) {
    return {
      ...next,
      phase: event.runPhase,
      activeActivityId: event.activeItemId || undefined,
    };
  }
  if (event.kind === "activity" || event.kind === "approval" || event.kind === "proposal") {
    if (!event.itemId) return next;
    const activity = activityFromAgentEvent(event.itemId, event, "Agent 步骤");
    return { ...next, activities: upsertActivityLine(next.activities, activity) };
  }
  if (event.kind === "delta" || event.kind === "message") return next;
  if (event.kind === "error") {
    return {
      ...next,
      status: "error",
      phase: "failed",
      activeActivityId: undefined,
      activities: settleActivityLines(next.activities, "error"),
      error: event.error || event.text || next.error,
    };
  }
  if (event.kind === "cancelled") {
    return {
      ...next,
      status: "cancelled",
      phase: "cancelled",
      activeActivityId: undefined,
      activities: settleActivityLines(next.activities, "cancelled"),
    };
  }
  if (event.kind === "done") {
    return {
      ...next,
      status: "completed",
      phase: "completed",
      activeActivityId: undefined,
      activities: settleActivityLines(next.activities, "completed"),
    };
  }
  return next;
}

export function normalizePersistedAgentRun(run: AgentRunInfo): AgentRunInfo {
  if (run.status === "running") {
    return {
      ...run,
      status: "error",
      phase: "failed",
      activeActivityId: undefined,
      activities: settleActivityLines(run.activities, "error"),
      error: run.error || "上次运行在应用关闭或刷新时中断。",
    };
  }
  const phase = run.status === "completed" ? "completed" : run.status === "error" ? "failed" : "cancelled";
  return {
    ...run,
    phase: run.schemaVersion === 2 ? phase : run.phase,
    activeActivityId: undefined,
    activities: settleActivityLines(run.activities, run.status),
  };
}
