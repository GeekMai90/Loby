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

    expect(result).toMatchObject([{ id: "activity-1", title: "完成 read_markdown", status: "completed", text: "已读取文稿" }]);
  });

  it("keeps image artifacts and moves the reply milestone to the end", () => {
    const imagePath = "/Users/example/Library/Caches/Loby/generated-images/result.png";
    const result = buildRunDisplayActivities([
      activity({ id: "response", title: "生成回复", status: "completed" }),
      activity({ id: "image", title: "完成 generate_image", status: "completed", artifactPath: imagePath }),
    ]);

    expect(result.map((item) => item.id)).toEqual(["image", "response"]);
    expect(result[0].artifactPath).toBe(imagePath);
  });
});
