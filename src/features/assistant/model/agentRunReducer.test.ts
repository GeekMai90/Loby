/**
 * [INPUT]: 依赖 Agent Event Protocol 与 renderer run reducer
 * [OUTPUT]: 验证 phase/item 投影、乱序拒绝、终态封口和 typed item id 对齐
 * [POS]: AI 助手事件 reducer 的协议回归，防止迟到事件重新打开已结束任务
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { describe, expect, it } from "vitest";
import type { AgentChatStreamEvent } from "@/features/assistant/model/agentRuntime";
import { createAgentRun, reduceAgentRunEvent } from "@/features/assistant/model/agentRunReducer";

function event(sequence: number, overrides: Partial<AgentChatStreamEvent>): AgentChatStreamEvent {
  return {
    requestId: "request-1",
    sequence,
    emittedAtMs: sequence,
    kind: "state",
    ...overrides,
  };
}

describe("agentRunReducer", () => {
  it("projects explicit reasoning and tool lifecycles without guessing from titles", () => {
    let run = createAgentRun();
    run = reduceAgentRunEvent(run, event(1, { runPhase: "reasoning", activeItemId: "assistant-reasoning" }));
    run = reduceAgentRunEvent(
      run,
      event(2, {
        kind: "activity",
        itemId: "assistant-reasoning",
        activityKind: "reasoning",
        activityState: "running",
        visibility: "detail",
        title: "任意 Provider 文案",
        text: "先梳理文章结构",
      }),
    );
    run = reduceAgentRunEvent(
      run,
      event(3, {
        kind: "activity",
        itemId: "assistant-reasoning",
        activityKind: "reasoning",
        activityState: "completed",
        visibility: "detail",
      }),
    );
    run = reduceAgentRunEvent(run, event(4, { runPhase: "executingTool", activeItemId: "tool-image" }));
    run = reduceAgentRunEvent(
      run,
      event(5, {
        kind: "activity",
        itemId: "tool-image",
        activityKind: "imageGeneration",
        activityState: "running",
        visibility: "milestone",
        toolName: "generate_image",
      }),
    );

    expect(run.phase).toBe("executingTool");
    expect(run.activeActivityId).toBe("tool-image");
    expect(run.activities).toMatchObject([
      { id: "assistant-reasoning", kind: "reasoning", state: "completed", text: "先梳理文章结构" },
      { id: "tool-image", kind: "imageGeneration", state: "running", toolName: "generate_image" },
    ]);
  });

  it("rejects late events and seals every active item at the terminal state", () => {
    let run = createAgentRun("waitingForModel");
    run = reduceAgentRunEvent(
      run,
      event(10, {
        kind: "activity",
        itemId: "tool-1",
        activityKind: "skill",
        activityState: "running",
        visibility: "milestone",
      }),
    );
    run = reduceAgentRunEvent(run, event(12, { kind: "done" }));
    const completed = run;
    run = reduceAgentRunEvent(run, event(11, { runPhase: "reasoning", activeItemId: "late" }));

    expect(run).toEqual(completed);
    expect(run).toMatchObject({ status: "completed", phase: "completed", lastSequence: 12 });
    expect(run.activities[0]).toMatchObject({ state: "completed", status: "completed" });
  });

  it("does not reopen a terminal run even when a late event has a newer global sequence", () => {
    let run = createAgentRun("waitingForModel");
    run = reduceAgentRunEvent(run, event(20, { kind: "done" }));
    const completed = run;

    run = reduceAgentRunEvent(run, event(21, { runPhase: "reasoning", activeItemId: "late-reasoning" }));
    run = reduceAgentRunEvent(
      run,
      event(22, {
        kind: "activity",
        itemId: "late-tool",
        activityKind: "tool",
        activityState: "running",
      }),
    );

    expect(run).toEqual(completed);
  });

  it("keeps the native typed item id aligned with activeItemId", () => {
    let run = createAgentRun("waitingForModel");
    run = reduceAgentRunEvent(run, event(1, { runPhase: "reasoning", activeItemId: "assistant-reasoning" }));
    run = reduceAgentRunEvent(
      run,
      event(2, {
        kind: "activity",
        itemId: "assistant-reasoning",
        activityKind: "reasoning",
        activityState: "running",
      }),
    );

    expect(run.activeActivityId).toBe("assistant-reasoning");
    expect(run.activities[0].id).toBe(run.activeActivityId);
  });

  it("turns proposal and approval events into typed timeline items", () => {
    let run = createAgentRun("waitingForModel");
    run = reduceAgentRunEvent(
      run,
      event(1, {
        kind: "approval",
        itemId: "approval-1",
        activityKind: "approval",
        activityState: "awaitingApproval",
        visibility: "milestone",
      }),
    );
    run = reduceAgentRunEvent(
      run,
      event(2, {
        kind: "proposal",
        itemId: "proposal-1",
        activityKind: "proposal",
        activityState: "completed",
        visibility: "milestone",
      }),
    );

    expect(run.activities.map((activity) => [activity.kind, activity.state])).toEqual([
      ["approval", "awaitingApproval"],
      ["proposal", "completed"],
    ]);
  });
});
