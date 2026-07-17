import { useCallback, useState } from "react";
import { upsertActivityLine } from "../lib/agentRunState";
import { cancelAgentChatStream, respondAgentApproval, streamAgentChat } from "../lib/codex";
import type { AgentProvider, AgentRunActivity, AgentRunInfo, AgentRuntimeSettings, AgentUsage } from "../types";

interface AgentStreamRunOptions {
  libraryPath: string;
  provider: AgentProvider;
  prompt: string;
  context: string;
  imagePaths?: string[];
  runtime?: AgentRuntimeSettings;
  threadId?: string;
  cliPath?: string;
  onRunChange: (run: AgentRunInfo) => void;
  onThreadId?: (threadId: string) => void;
}

export interface AgentStreamRunResult {
  output: string;
  run: AgentRunInfo;
}

export function useAgentStreamRun() {
  const [activeRequestId, setActiveRequestId] = useState("");

  const runAgent = useCallback(async (options: AgentStreamRunOptions): Promise<AgentStreamRunResult> => {
    let output = "";
    let activities: AgentRunActivity[] = [];
    let usage: AgentUsage | null = null;
    let failure = "";
    let cancelled = false;
    let currentRun: AgentRunInfo = { status: "running", activities, usage };

    function publishRun(status: AgentRunInfo["status"] = "running", error?: string) {
      currentRun = {
        status,
        activities,
        usage,
        error: error || undefined,
      };
      options.onRunChange(currentRun);
    }

    publishRun();

    try {
      await streamAgentChat({
        libraryPath: options.libraryPath,
        provider: options.provider,
        prompt: options.prompt,
        context: options.context,
        imagePaths: options.imagePaths,
        runtime: options.runtime,
        threadId: options.threadId,
        cliPath: options.cliPath,
        onRequestId: setActiveRequestId,
        onDelta: (delta) => {
          output += delta;
          activities = upsertActivityLine(
            activities,
            activityFromEvent("assistant-message-stream", {
              rawType: "item/agentMessage/delta",
              title: "生成回复",
              status: "in_progress",
            }),
          );
          publishRun();
        },
        onStatus: (event) => {
          if ((event.rawType === "thread/start.result" || event.rawType === "thread/resume.result") && event.status) {
            options.onThreadId?.(event.status);
          }
          activities = upsertActivityLine(
            activities,
            activityFromEvent(event.rawType || `status-${activities.length}`, event, "Codex 状态"),
          );
          publishRun();
        },
        onActivity: (event) => {
          const activity = activityFromEvent(event.itemId || `${event.rawType}-${activities.length}`, event, "Codex 步骤");
          if (event.kind === "approval" && event.itemId && options.runtime?.executionMode === "autonomous-read") {
            activity.status = "decline";
            void respondAgentApproval(event.itemId, "decline");
          }
          activities = upsertActivityLine(activities, activity);
          publishRun();
        },
        onUsage: (nextUsage) => {
          usage = nextUsage;
          publishRun();
        },
        onError: (message) => {
          failure = message;
          publishRun("error", message);
        },
        onCancelled: (message) => {
          cancelled = true;
          failure = message;
          publishRun("cancelled");
        },
      });
    } catch (cause) {
      failure = cause instanceof Error ? cause.message : String(cause);
    } finally {
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
  };
}
