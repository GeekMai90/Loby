/**
 * [INPUT]: 依赖 React 运行时、AI 助手流事件/帧批处理/阶段耗时/活动终态模块、shared 公共契约
 * [OUTPUT]: 对外提供 AgentStreamRunResult、useAgentStreamRun，并在运行结束前封口全部子活动
 * [POS]: AI 助手 feature 的 React 运行协调边界，统一流状态、副作用、终态与用户动作
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useCallback, useState } from "react";
import { settleActivityLines, upsertActivityLine } from "@/features/assistant/model/agentRunState";
import { appendAgentMessageDelta, completeAgentMessage } from "@/features/assistant/model/agentMessageStream";
import { cancelAgentChatStream, respondAgentApproval, streamAgentChat } from "@/features/assistant/model/agentRuntime";
import type { AgentProvider, AgentRunActivity, AgentRunInfo, AgentRunTimings, AgentRuntimeSettings, AgentUsage } from "@/shared/types";
import { applyAgentRunMetric } from "@/features/assistant/model/agentRunTimings";
import { createStreamFrameBatcher } from "@/features/assistant/model/streamFrameBatcher";

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
    let activities: AgentRunActivity[] = [];
    let usage: AgentUsage | null = null;
    let timings: AgentRunTimings = {};
    let failure = "";
    let cancelled = false;
    let currentRun: AgentRunInfo = { status: "running", activities, usage };

    function publishRun(status: AgentRunInfo["status"] = "running", error?: string) {
      currentRun = {
        status,
        activities: settleActivityLines(activities, status),
        usage,
        timings,
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
        onDelta: (delta, event) => {
          const next = appendAgentMessageDelta(
            { content: output, itemId: agentMessageItemId, segments: agentMessageSegments },
            delta,
            event?.itemId,
          );
          output = next.content;
          agentMessageItemId = next.itemId;
          agentMessageSegments = next.segments;
          activities = upsertActivityLine(
            activities,
            activityFromEvent("assistant-message-stream", {
              rawType: "item/agentMessage/delta",
              title: "生成回复",
              status: "in_progress",
            }),
          );
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
          activities = upsertActivityLine(
            activities,
            activityFromEvent("assistant-message-stream", {
              rawType: "item/agentMessage/completed",
              title: "生成回复",
              status: "in_progress",
            }),
          );
          streamUpdates.schedule();
        },
        onStatus: (event) => {
          activities = upsertActivityLine(
            activities,
            activityFromEvent(event.rawType || `status-${activities.length}`, event, "Agent 状态"),
          );
          streamUpdates.schedule();
        },
        onActivity: (event) => {
          const activity = activityFromEvent(event.itemId || `${event.rawType}-${activities.length}`, event, "Agent 步骤");
          if (event.kind === "approval" && event.itemId && options.runtime?.executionMode === "autonomous-read") {
            activity.status = "decline";
            void respondAgentApproval(event.itemId, "decline");
          }
          activities = upsertActivityLine(activities, activity);
          streamUpdates.schedule();
        },
        onUsage: (nextUsage) => {
          usage = nextUsage;
          streamUpdates.schedule();
        },
        onMetric: (metric) => {
          timings = applyAgentRunMetric(timings, metric);
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

    if (!failure && output.trim()) {
      activities = upsertActivityLine(
        activities,
        activityFromEvent("assistant-message-stream", {
          rawType: "item/agentMessage/delta",
          title: "生成回复",
          status: "completed",
        }),
      );
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

function activityFromEvent(
  id: string,
  event: {
    rawType?: string;
    title?: string;
    status?: string;
    command?: string;
    output?: string;
    text?: string;
    artifactPath?: string;
    exitCode?: number | null;
  },
  fallbackTitle = "",
): AgentRunActivity {
  return {
    id,
    rawType: event.rawType || "",
    title: event.title || fallbackTitle,
    status: event.status || "",
    command: event.command || "",
    output: event.output || "",
    text: event.text || "",
    exitCode: event.exitCode ?? null,
    artifactPath: event.artifactPath || undefined,
  };
}
