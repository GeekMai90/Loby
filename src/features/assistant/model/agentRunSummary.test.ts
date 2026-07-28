/**
 * [INPUT]: 依赖 AgentRunInfo phase、activeActivityId 与展示活动
 * [OUTPUT]: 验证折叠摘要只投影权威 phase/active item，并隔离旧会话推断
 * [POS]: AI 助手运行摘要的展示回归，禁止从自由文案拼接不通顺状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { describe, expect, it } from "vitest";
import { buildRunSummary } from "@/features/assistant/model/agentRunSummary";
import { ASSISTANT_MODEL_WAITING_LABELS } from "@/features/assistant/constants/assistantRun";
import type { AgentRunActivity, AgentRunInfo } from "@/shared/types";

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
      activity({ id: "status", rawType: "thread/status/changed", title: "Agent 正在运行", status: "active" }),
      activity({ id: "turn", rawType: "turn/started", title: "开始处理", status: "turn-1" }),
      activity({ id: "mcp", rawType: "mcpServer/startupStatus/updated", title: "MCP capacities 启动失败", status: "failed" }),
      activity({ id: "warning", rawType: "warning", title: "Provider 提示", status: "" }),
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
        command: "/bin/zsh -lc 'npm run test -- --run src/features/assistant/model/agentRunSummary.test.ts'",
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

    expect(buildRunSummary(run({ status: "completed", activities }), activities, "正在整理思路")).toBe("处理完成，2 个步骤");
  });

  it("uses the action kind instead of prefixing a terminal title", () => {
    const activities = [activity({ rawType: "agent/tool", title: "模型回复完成", status: "in_progress" })];

    const summary = buildRunSummary(run({ activities }), activities);

    expect(summary).toBe("正在生成回复");
    expect(summary).not.toMatch(/^正在.*(?:完成|失败|已)/);
  });

  it.each([
    ["agent/tool", "调用 generate_image", "正在生成图片"],
    ["agent/tool", "调用 search_web", "正在搜索资料"],
    ["agent/tool", "调用 activate_skill", "正在执行 Skill"],
  ])("maps %s activity %s to a truthful running summary", (rawType, title, expected) => {
    const activities = [activity({ rawType, title, status: "in_progress" })];

    expect(buildRunSummary(run({ activities }), activities)).toBe(expected);
  });

  it("uses one stable fallback when no concrete action is available", () => {
    expect(buildRunSummary(run({ activities: [] }), [])).toBe("正在处理");
  });

  it("uses the authoritative phase and active item instead of array order", () => {
    const activities = [
      activity({ id: "image", kind: "imageGeneration", state: "running", toolName: "generate_image" }),
      activity({ id: "stale", kind: "reasoning", state: "running" }),
    ];

    expect(buildRunSummary(run({ schemaVersion: 2, phase: "executingTool", activeActivityId: "image", activities }), activities)).toBe(
      "正在生成图片",
    );
  });

  it.each([
    ["preparingContext", "正在准备写作上下文"],
    ["waitingForModel", ASSISTANT_MODEL_WAITING_LABELS[0]],
    ["reasoning", "正在整理思路"],
    ["waitingForApproval", "等待你确认"],
    ["streamingAnswer", "正在生成回复"],
    ["finalizing", "正在整理结果"],
  ] as const)("maps authoritative %s phase to a stable summary", (phase, expected) => {
    expect(buildRunSummary(run({ schemaVersion: 2, phase }), [])).toBe(expected);
  });
});
