import { describe, expect, it } from "vitest";
import { buildRunSummary } from "./agentRunSummary";
import type { AgentRunActivity, AgentRunInfo } from "../types";

function activity(overrides: Partial<AgentRunActivity>): AgentRunActivity {
  return {
    id: "activity-1",
    rawType: "item/started",
    title: "运行命令",
    status: "in_progress",
    command: "",
    output: "",
    text: "",
    exitCode: null,
    ...overrides,
  };
}

function run(overrides: Partial<AgentRunInfo>): AgentRunInfo {
  return {
    status: "running",
    activities: [],
    usage: null,
    ...overrides,
  };
}

describe("agentRunSummary", () => {
  it("uses fallback when only background status activities are active", () => {
    const activities = [
      activity({ id: "status", rawType: "thread/status/changed", title: "Codex 正在运行", status: "active" }),
      activity({ id: "turn", rawType: "turn/started", title: "开始处理", status: "turn-1" }),
      activity({ id: "mcp", rawType: "mcpServer/startupStatus/updated", title: "MCP capacities 启动失败", status: "failed" }),
      activity({ id: "warning", rawType: "warning", title: "Codex 提示", status: "" }),
    ];

    expect(buildRunSummary(run({ activities }), activities, "正在整理思路")).toBe("正在整理思路");
  });

  it("summarizes the latest active command with a compact command preview", () => {
    const activities = [
      activity({ id: "reasoning", rawType: "item/reasoning/textDelta", title: "思考过程", status: "in_progress" }),
      activity({
        id: "command",
        rawType: "item/commandExecution/outputDelta",
        title: "命令输出",
        status: "in_progress",
        command: "/bin/zsh -lc 'npm run test -- --run src/lib/agentRunSummary.test.ts'",
      }),
    ];

    expect(buildRunSummary(run({ activities }), activities, "正在整理思路")).toBe("正在运行命令：/bin/zsh -lc 'npm run tes...");
  });

  it("shows a user confirmation state for pending approvals", () => {
    const activities = [
      activity({
        id: "approval",
        rawType: "item/fileChange/requestApproval",
        title: "需要文件修改审批",
        status: "pending",
      }),
    ];

    expect(buildRunSummary(run({ activities }), activities, "正在整理思路")).toBe("等待你确认");
  });

  it("shows response generation when assistant text is streaming", () => {
    const activities = [
      activity({ id: "reasoning", rawType: "item/reasoning/textDelta", title: "思考过程", status: "completed" }),
      activity({ id: "assistant", rawType: "item/agentMessage/delta", title: "生成回复", status: "in_progress" }),
    ];

    expect(buildRunSummary(run({ activities }), activities, "正在整理思路")).toBe("正在生成回复");
  });

  it("summarizes completed runs with the activity count", () => {
    const activities = [activity({ status: "completed" }), activity({ id: "assistant", title: "生成回复", status: "completed" })];

    expect(buildRunSummary(run({ status: "completed", activities }), activities, "正在整理思路")).toBe("思考完成，2 个步骤");
  });
});
