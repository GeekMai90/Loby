import { describe, expect, it } from "vitest";
import type { AgentRunActivity } from "../types";
import { buildRunDisplayActivities } from "./agentRunPresentation";

function activity(overrides: Partial<AgentRunActivity>): AgentRunActivity {
  return {
    id: "activity-1",
    rawType: "item/completed",
    title: "完成工具步骤",
    status: "completed",
    command: "",
    output: "",
    text: "",
    exitCode: null,
    ...overrides,
  };
}

describe("agentRunPresentation", () => {
  it("removes protocol noise and empty reasoning activities", () => {
    const result = buildRunDisplayActivities([
      activity({ id: "status", rawType: "thread/status/changed", title: "Codex 空闲", status: "idle" }),
      activity({ id: "turn", rawType: "turn/started", title: "开始处理" }),
      activity({ id: "reasoning", rawType: "item/completed", title: "思考过程" }),
      activity({ id: "generic" }),
      activity({
        id: "mcp",
        rawType: "mcpServer/startupStatus/updated",
        title: "MCP capacities 启动失败",
        status: "failed",
        text: "The capacities MCP server is not logged in.",
      }),
    ]);

    expect(result).toEqual([]);
  });

  it("turns image generation commands into concise milestones", () => {
    const result = buildRunDisplayActivities([
      activity({
        id: "skill",
        rawType: "item/completed",
        title: "运行命令",
        command: "sed -n '1,240p' /Users/example/.agents/skills/every-editorial-cover/SKILL.md",
      }),
      activity({
        id: "save",
        rawType: "item/completed",
        title: "运行命令",
        command: "cp /Users/example/.codex/generated_images/cover.png /Users/example/Documents/cover.png",
      }),
      activity({ id: "response", rawType: "item/agentMessage/delta", title: "生成回复" }),
    ]);

    expect(result.map((item) => item.title)).toEqual(["读取 Every 封面技能", "生成图片", "保存生成的图片", "生成回复"]);
  });

  it("keeps a plaintext reasoning summary but removes the technical duplicate", () => {
    const result = buildRunDisplayActivities([
      activity({
        id: "reasoning",
        rawType: "item/reasoning/summaryTextDelta",
        title: "思考过程",
        output: "先确认文章主题，再生成封面。",
      }),
    ]);

    expect(result).toMatchObject([{ title: "整理思路", text: "先确认文章主题，再生成封面。", output: "" }]);
  });

  it("merges repeated waiting activities", () => {
    const result = buildRunDisplayActivities([
      activity({ id: "wait-1", rawType: "item/completed", title: "等待处理" }),
      activity({ id: "wait-2", rawType: "item/completed", title: "等待处理" }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("等待处理");
  });
});
