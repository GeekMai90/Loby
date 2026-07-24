import { describe, expect, it } from "vitest";
import { upsertActivityLine, upsertApprovalRequest } from "@/features/assistant/model/agentRunState";
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
        artifactPath: "/Users/example/.codex/generated_images/result.png",
      }),
    ];

    const next = upsertActivityLine(lines, activity({ output: "new", status: "", command: "" }));

    expect(next[0].output).toBe("new");
    expect(next[0].status).toBe("running");
    expect(next[0].command).toBe("npm run build");
    expect(next[0].artifactPath).toBe("/Users/example/.codex/generated_images/result.png");
  });
});
