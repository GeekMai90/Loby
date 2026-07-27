import { describe, expect, it } from "vitest";
import type { AgentRunActivity } from "@/shared/types";
import { buildRunDisplayActivities } from "@/features/assistant/model/agentRunPresentation";

function activity(overrides: Partial<AgentRunActivity>): AgentRunActivity {
  return {
    id: "activity-1",
    rawType: "agent/tool",
    title: "调用 read_markdown",
    status: "in_progress",
    command: "",
    output: "",
    text: "",
    exitCode: null,
    ...overrides,
  };
}

describe("agentRunPresentation", () => {
  it("merges one tool lifecycle by stable item id", () => {
    const result = buildRunDisplayActivities([
      activity({ status: "in_progress" }),
      activity({ title: "完成 read_markdown", status: "completed", text: "已读取文稿" }),
    ]);

    expect(result).toMatchObject([
      { id: "activity-1", kind: "tool", state: "completed", title: "read_markdown 调用完成", status: "completed", text: "已读取文稿" },
    ]);
  });

  it("keeps image artifacts and hides redundant reply bookkeeping", () => {
    const imagePath = "/Users/example/Library/Caches/Loby/generated-images/result.png";
    const result = buildRunDisplayActivities([
      activity({ id: "response", title: "生成回复", status: "completed" }),
      activity({ id: "image", title: "完成 generate_image", status: "completed", artifactPath: imagePath }),
    ]);

    expect(result.map((item) => item.id)).toEqual(["image"]);
    expect(result[0].artifactPath).toBe(imagePath);
    expect(result.map((item) => item.title)).toEqual(["图片已生成"]);
  });

  it("normalizes legacy terminal wording without adding a running prefix", () => {
    const result = buildRunDisplayActivities([
      activity({ id: "provider", rawType: "agent/tool", title: "模型回复完成", status: "completed" }),
      activity({ id: "search", title: "完成 search_web", status: "completed" }),
    ]);

    expect(result.map((item) => item.title)).toEqual(["资料搜索完成"]);
    expect(result.every((item) => !item.title.startsWith("正在"))).toBe(true);
  });

  it("keeps diagnostic runtime events out of the user timeline", () => {
    const result = buildRunDisplayActivities([
      activity({ id: "diagnostic", kind: "status", state: "failed", visibility: "diagnostic", title: "MCP server 暂不可用" }),
      activity({ id: "skill", kind: "skill", state: "completed", visibility: "milestone", title: "完成 activate_skill" }),
    ]);

    expect(result.map((item) => item.id)).toEqual(["skill"]);
  });

  it("shows pending approval but removes its terminal bookkeeping after the tool resumes", () => {
    const pending = buildRunDisplayActivities([
      activity({ id: "approval", kind: "approval", state: "awaitingApproval", visibility: "milestone", title: "需要工具审批" }),
    ]);
    const completed = buildRunDisplayActivities([
      activity({ id: "approval", kind: "approval", state: "completed", visibility: "milestone", title: "工具审批已确认" }),
      activity({ id: "skill", kind: "skill", state: "running", visibility: "milestone", title: "调用 create_skill" }),
    ]);

    expect(pending.map((item) => item.id)).toEqual(["approval"]);
    expect(completed.map((item) => item.id)).toEqual(["skill"]);
  });

  it("collapses reasoning milestones from old conversations into one latest row", () => {
    const result = buildRunDisplayActivities([
      activity({ id: "reasoning-0", rawType: "agent/reasoning/summary", title: "整理思路", status: "completed", text: "第一步" }),
      activity({ id: "skill", title: "完成 activate_skill", status: "completed" }),
      activity({ id: "reasoning-1", rawType: "agent/reasoning/summary", title: "整理思路", status: "completed", text: "第二步" }),
      activity({ id: "image", title: "完成 generate_image", status: "completed" }),
    ]);

    expect(result.filter((item) => item.kind === "reasoning")).toHaveLength(1);
    expect(result.find((item) => item.kind === "reasoning")?.text).toBe("第二步");
  });

  it("localizes persisted english reasoning and strips markdown from chinese summaries", () => {
    const english = buildRunDisplayActivities([
      activity({
        id: "reasoning-en",
        kind: "reasoning",
        state: "completed",
        text: "**Generating abstract markdown image****Verifying generated image path compatibility**",
      }),
    ]);
    const chinese = buildRunDisplayActivities([
      activity({ id: "reasoning-zh", kind: "reasoning", state: "completed", text: "**生成封面****检查图片路径**" }),
    ]);

    expect(english[0].text).toBe("模型正在分析任务并规划下一步操作。");
    expect(chinese[0].text).toBe("生成封面\n检查图片路径");
  });
});
