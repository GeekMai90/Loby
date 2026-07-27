/**
 * [INPUT]: 依赖 React、Agent Event Protocol reducer、消息增量、帧批处理与阶段耗时
 * [OUTPUT]: 对外提供 AgentStreamRunResult、useAgentStreamRun，所有 Runtime 事件经单一 reducer 形成可持久化快照
 * [POS]: AI 助手 feature 的通用运行协调边界，不再创建虚假的“生成回复”活动或从回调顺序推断 phase
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useCallback, useState } from "react";
import { settleActivityLines } from "@/features/assistant/model/agentRunState";
import { appendAgentMessageDelta, completeAgentMessage } from "@/features/assistant/model/agentMessageStream";
import { cancelAgentChatStream, respondAgentApproval, streamAgentChat } from "@/features/assistant/model/agentRuntime";
import type { AgentProvider, AgentRunInfo, AgentRuntimeSettings } from "@/shared/types";
import { applyAgentRunMetric } from "@/features/assistant/model/agentRunTimings";
import { createStreamFrameBatcher } from "@/features/assistant/model/streamFrameBatcher";
import { createAgentRun, reduceAgentRunEvent } from "@/features/assistant/model/agentRunReducer";

interface AgentStreamRunOptions {
  libraryPath: string;
  provider: AgentProvider;
  prompt: string;
  context: string;
  attachmentPaths?: string[];
  runtime?: AgentRuntimeSettings;
  onRunChange: (run: AgentRunInfo) => void;
}

export interface AgentStreamRunResult {
  output: string;
  run: AgentRunInfo;
}

export function useAgentStreamRun() {
  const [activeRequestId, setActiveRequestId] = useState("");

  const runAgent = useCallback(async (options: AgentStreamRunOptions): Promise<AgentStreamRunResult> => {
    let output = "";
    let agentMessageItemId = "";
    let agentMessageSegments: { itemId: string; text: string }[] | undefined;
    let failure = "";
    let cancelled = false;
    let currentRun = createAgentRun("waitingForModel");

    function publishRun(status: AgentRunInfo["status"] = currentRun.status, error?: string) {
      currentRun = {
        ...currentRun,
        status,
        phase:
          status === "completed" ? "completed" : status === "error" ? "failed" : status === "cancelled" ? "cancelled" : currentRun.phase,
        activeActivityId: status === "running" ? currentRun.activeActivityId : undefined,
        activities: settleActivityLines(currentRun.activities, status),
        error: error || undefined,
      };
      options.onRunChange(currentRun);
    }

    publishRun();
    const streamUpdates = createStreamFrameBatcher(() => publishRun());

    try {
      await streamAgentChat({
        libraryPath: options.libraryPath,
        provider: options.provider,
        prompt: options.prompt,
        context: options.context,
        attachmentPaths: options.attachmentPaths,
        runtime: options.runtime,
        onRequestId: setActiveRequestId,
        onEvent: (event) => {
          currentRun = reduceAgentRunEvent(currentRun, event);
          streamUpdates.schedule();
        },
        onDelta: (delta, event) => {
          const next = appendAgentMessageDelta(
            { content: output, itemId: agentMessageItemId, segments: agentMessageSegments },
            delta,
            event?.itemId,
          );
          output = next.content;
          agentMessageItemId = next.itemId;
          agentMessageSegments = next.segments;
          streamUpdates.schedule();
        },
        onMessage: (text, event) => {
          const next = completeAgentMessage(
            { content: output, itemId: agentMessageItemId, segments: agentMessageSegments },
            text,
            event.itemId,
          );
          output = next.content;
          agentMessageItemId = next.itemId;
          agentMessageSegments = next.segments;
          streamUpdates.schedule();
        },
        onActivity: (event) => {
          if (event.kind === "approval" && event.itemId && options.runtime?.executionMode === "autonomous-read") {
            void respondAgentApproval(event.itemId, "decline");
          }
        },
        onUsage: (nextUsage) => {
          currentRun = { ...currentRun, usage: nextUsage };
          streamUpdates.schedule();
        },
        onMetric: (metric) => {
          currentRun = { ...currentRun, timings: applyAgentRunMetric(currentRun.timings ?? {}, metric) };
          streamUpdates.schedule();
        },
        onError: (message) => {
          failure = message;
          streamUpdates.cancel();
          publishRun("error", message);
        },
        onCancelled: (message) => {
          cancelled = true;
          failure = message;
          streamUpdates.cancel();
          publishRun("cancelled");
        },
      });
    } catch (cause) {
      failure = cause instanceof Error ? cause.message : String(cause);
    } finally {
      streamUpdates.flushNow();
      setActiveRequestId("");
    }

    publishRun(cancelled ? "cancelled" : failure ? "error" : "completed", cancelled ? undefined : failure);
    return { output, run: currentRun };
  }, []);

  const cancel = useCallback(async () => {
    if (!activeRequestId) return;
    await cancelAgentChatStream(activeRequestId);
  }, [activeRequestId]);

  return {
    activeRequestId,
    runAgent,
    cancel,
  };
}
