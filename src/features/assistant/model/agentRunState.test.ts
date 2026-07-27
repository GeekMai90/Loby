import { describe, expect, it } from "vitest";
import { settleActivityLines, upsertActivityLine, upsertApprovalRequest } from "@/features/assistant/model/agentRunState";
import type { AgentApprovalRequest, AgentRunActivity } from "@/shared/types";

function activity(overrides: Partial<AgentRunActivity>): AgentRunActivity {
  return {
    id: "activity-1",
    rawType: "item/complete",
    title: "读取文件",
    status: "completed",
    command: "",
    output: "",
    text: "",
    exitCode: null,
    ...overrides,
  };
}

function approval(overrides: Partial<AgentApprovalRequest>): AgentApprovalRequest {
  return {
    id: "approval-1",
    assistantMessageId: "assistant-1",
    title: "运行命令",
    command: "npm test",
    reason: "",
    status: "pending",
    ...overrides,
  };
}

describe("agentRunState", () => {
  it("updates an existing approval request without changing order", () => {
    const requests = [approval({ id: "approval-1", status: "pending" }), approval({ id: "approval-2", status: "pending" })];

    const next = upsertApprovalRequest(requests, approval({ id: "approval-1", status: "accept" }));

    expect(next.map((request) => request.id)).toEqual(["approval-1", "approval-2"]);
    expect(next[0].status).toBe("accept");
  });

  it("appends streaming activity output deltas", () => {
    const lines = [activity({ rawType: "exec/outputDelta", output: "hel" })];

    const next = upsertActivityLine(lines, activity({ rawType: "exec/outputDelta", output: "lo" }));

    expect(next).toHaveLength(1);
    expect(next[0].output).toBe("hello");
  });

  it("replaces non-streaming activity output while retaining fallback fields", () => {
    const lines = [
      activity({
        output: "old",
        status: "running",
        command: "npm run build",
        artifactPath: "/Users/example/Library/Caches/Loby/generated-images/result.png",
      }),
    ];

    const next = upsertActivityLine(lines, activity({ output: "new", status: "", command: "" }));

    expect(next[0].output).toBe("new");
    expect(next[0].status).toBe("running");
    expect(next[0].command).toBe("npm run build");
    expect(next[0].artifactPath).toBe("/Users/example/Library/Caches/Loby/generated-images/result.png");
  });

  it("settles unfinished child activities with the terminal run status", () => {
    const lines = [
      activity({ id: "started", status: "in_progress" }),
      activity({ id: "pending", status: "pending" }),
      activity({ id: "done", status: "completed" }),
    ];

    expect(settleActivityLines(lines, "completed").map((line) => line.status)).toEqual(["completed", "completed", "completed"]);
    expect(settleActivityLines(lines, "error").map((line) => line.status)).toEqual(["failed", "failed", "completed"]);
    expect(settleActivityLines(lines, "cancelled").map((line) => line.status)).toEqual(["cancelled", "cancelled", "completed"]);
    expect(settleActivityLines(lines, "completed").map((line) => line.state)).toEqual(["completed", "completed", undefined]);
    expect(settleActivityLines(lines, "running")).toBe(lines);
  });

  it("settles reasoning as soon as the next concrete activity starts and keeps one recent reasoning row", () => {
    let lines = upsertActivityLine(
      [],
      activity({ id: "assistant-reasoning-stream", kind: "reasoning", state: "running", status: "in_progress", title: "整理思路" }),
    );
    lines = upsertActivityLine(
      lines,
      activity({ id: "skill", kind: "skill", state: "running", status: "in_progress", title: "调用 activate_skill" }),
    );

    expect(lines.find((line) => line.kind === "reasoning")?.state).toBe("completed");

    lines = upsertActivityLine(
      lines,
      activity({ id: "assistant-reasoning-stream", kind: "reasoning", state: "running", status: "in_progress", title: "整理思路" }),
    );

    expect(lines.filter((line) => line.kind === "reasoning")).toHaveLength(1);
    expect(lines.at(-1)).toMatchObject({ kind: "reasoning", state: "running" });
  });
});
