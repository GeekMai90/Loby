/**
 * [INPUT]: 依赖 typed 与 legacy Agent activity 适配器
 * [OUTPUT]: 验证原生 item id 保留、旧会话稳定别名和语义兼容推断
 * [POS]: AI 助手事件兼容边界的单元回归，确保新协议不再依赖展示标题
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { describe, expect, it } from "vitest";
import { activityFromAgentEvent, resolveAgentActivityKind, resolveAgentActivityState } from "@/features/assistant/model/agentRunEvents";
import type { AgentRunActivity } from "@/shared/types";

describe("agentRunEvents", () => {
  it("keeps provider bookkeeping out of the visible response lifecycle", () => {
    const request = activityFromAgentEvent("provider-request", {
      rawType: "agent/tool",
      itemType: "toolCall",
      title: "请求模型",
      status: "in_progress",
    });
    const response = activityFromAgentEvent("message-request-1", {
      rawType: "item/agentMessage/completed",
      itemType: "agentMessage",
      title: "生成回复",
      status: "completed",
    });

    expect(request).toMatchObject({ id: "provider-request", kind: "status", state: "running" });
    expect(response).toMatchObject({ id: "assistant-message-stream", kind: "modelResponse", state: "completed" });
  });

  it("uses one stable reasoning activity across provider steps", () => {
    const first = activityFromAgentEvent("reasoning-summary-0", {
      rawType: "agent/reasoning/summary",
      title: "整理思路",
      status: "in_progress",
    });
    const second = activityFromAgentEvent("model-note-1", {
      rawType: "agent/tool",
      title: "模型准备调用工具",
      status: "completed",
    });

    expect(first.id).toBe("assistant-reasoning-stream");
    expect(second.id).toBe("assistant-reasoning-stream");
  });

  it("preserves typed runtime ids instead of applying legacy aliases", () => {
    const activity = activityFromAgentEvent("assistant-reasoning", {
      activityKind: "reasoning",
      activityState: "running",
      rawType: "agent/activity/reasoning",
    });

    expect(activity.id).toBe("assistant-reasoning");
  });

  it("derives stable semantics for old persisted activities", () => {
    const legacy = {
      id: "legacy-image",
      rawType: "agent/tool",
      title: "完成 generate_image",
      status: "completed",
      command: "",
      output: "",
      text: "",
      exitCode: null,
    } satisfies AgentRunActivity;

    expect(resolveAgentActivityKind(legacy)).toBe("imageGeneration");
    expect(resolveAgentActivityState(legacy)).toBe("completed");
    expect(
      resolveAgentActivityKind({
        ...legacy,
        id: "legacy-search",
        title: "完成 web_search",
      }),
    ).toBe("webSearch");
  });

  it("does not treat a status-less bookkeeping event as running work", () => {
    const activity = activityFromAgentEvent("warning", { rawType: "warning", title: "Provider 提示" });

    expect(activity.state).toBe("unknown");
  });

  it("keeps failed model requests in the response lifecycle", () => {
    const activity = activityFromAgentEvent("provider-request", {
      rawType: "agent/tool",
      title: "模型请求失败",
      status: "failed",
    });

    expect(activity).toMatchObject({ id: "provider-request", kind: "status", state: "failed" });
  });
});
