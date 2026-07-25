/**
 * [INPUT]: 依赖 Vitest、agentImageArtifacts 与 shared AI action/run 契约
 * [OUTPUT]: 验证生成图来源关联和 run/action 跨来源去重，同时保留无关运行产物
 * [POS]: assistant model 的图片成果身份回归测试，覆盖新来源标识与旧 copy activity 恢复路径
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { describe, expect, it } from "vitest";
import { collectVisibleRunImageArtifactPaths, linkGeneratedImageActions } from "@/features/assistant/model/agentImageArtifacts";
import type { AgentRunActivity, AiAction } from "@/shared/types";

const generatedPath = "/Users/example/.codex/generated_images/run/generated.png";
const durablePath = "/Users/example/Loby/assets/images/cover.png";

describe("agentImageArtifacts", () => {
  it("links a legacy copied image action to its original generated artifact", () => {
    const linked = linkGeneratedImageActions(
      [imageAction()],
      [imageActivity(), activity("copy", `cp '${generatedPath}' '${durablePath}'`)],
    );

    expect(linked[0].sourceArtifactPath).toBe(generatedPath);
  });

  it("hides a run artifact only when a renderable image action covers the same source", () => {
    const activities = [imageActivity(), activity("copy", `cp '${generatedPath}' '${durablePath}'`)];

    expect(collectVisibleRunImageArtifactPaths(activities, [imageAction()])).toEqual([]);
    expect(collectVisibleRunImageArtifactPaths(activities, [])).toEqual([generatedPath]);
  });

  it("uses persisted source lineage without depending on historical command text", () => {
    expect(collectVisibleRunImageArtifactPaths([imageActivity()], [imageAction({ sourceArtifactPath: generatedPath })])).toEqual([]);
  });
});

function imageAction(overrides: Partial<AiAction> = {}): AiAction {
  return {
    id: "action-image",
    type: "insertImage",
    status: "applied",
    title: "插入图片：封面",
    summary: "插入生成的封面",
    payload: { path: "../../../assets/images/cover.png", alt: "封面" },
    createdAt: "2026-07-25T00:00:00.000Z",
    ...overrides,
  };
}

function imageActivity(): AgentRunActivity {
  return {
    ...activity("generated", ""),
    rawType: "item/completed",
    title: "生成图片",
    artifactPath: generatedPath,
  };
}

function activity(id: string, command: string): AgentRunActivity {
  return {
    id,
    rawType: "item/completed",
    title: "执行操作",
    status: "completed",
    command,
    output: "",
    text: "",
    exitCode: 0,
  };
}
