/**
 * [INPUT]: 依赖 React、Agent Event Protocol reducer、消息增量、帧批处理与阶段耗时
 * [OUTPUT]: 对外提供 AgentStreamRunResult、useAgentStreamRun，统一传递会话历史、运行身份并经单一 reducer 形成可持久化快照
 * [POS]: AI 助手 feature 的通用运行协调边界，供主助手与领域助手共享 stream、会话、取消和引导能力
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useCallback, useState } from "react";
import { settleActivityLines } from "@/features/assistant/model/agentRunState";
import { appendAgentMessageDelta, completeAgentMessage } from "@/features/assistant/model/agentMessageStream";
import {
  cancelAgentChatStream,
  respondAgentApproval,
  steerAgentChatStream,
  streamAgentChat,
} from "@/features/assistant/model/agentRuntime";
import type { AgentConversationMessage, AgentProvider, AgentRunInfo, AgentRuntimeSettings } from "@/shared/types";
import { applyAgentRunMetric } from "@/features/assistant/model/agentRunTimings";
import { createStreamFrameBatcher } from "@/features/assistant/model/streamFrameBatcher";
import { createAgentRun, reduceAgentRunEvent } from "@/features/assistant/model/agentRunReducer";

interface AgentStreamRunOptions {
  libraryPath: string;
  provider: AgentProvider;
  prompt: string;
  context: string;
  conversationMessages?: AgentConversationMessage[];
  conversationId?: string;
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
        conversationMessages: options.conversationMessages,
        conversationId: options.conversationId,
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

  const steer = useCallback(
    async (text: string) => {
      if (!activeRequestId || !text.trim()) return;
      await steerAgentChatStream(activeRequestId, text);
    },
    [activeRequestId],
  );

  return {
    activeRequestId,
    runAgent,
    cancel,
    steer,
  };
}
