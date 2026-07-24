/**
 * [INPUT]: 依赖 React DOM、Vitest、AssistantRunArtifacts 与 Tauri asset URL mock
 * [OUTPUT]: 验证 Codex imageGeneration 本地产物去重后完整呈现在消息流
 * [POS]: assistant/components 的生成图片结果回归测试，保护无文字 final 的可见成果
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantRunArtifacts } from "@/features/assistant/components/AssistantRunArtifacts";
import type { AgentRunActivity } from "@/shared/types";

vi.mock("@tauri-apps/api/core", () => ({ convertFileSrc: (path: string) => `asset:${path}` }));
vi.mock("@/features/library/model/persistence", () => ({ previewImage: vi.fn() }));

function activity(id: string, artifactPath?: string): AgentRunActivity {
  return {
    id,
    rawType: "item/completed",
    title: "生成图片",
    status: "completed",
    command: "",
    output: "",
    text: "",
    exitCode: null,
    artifactPath,
  };
}

describe("AssistantRunArtifacts", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders one preview for a recovered local image artifact", async () => {
    const imagePath = "/Users/example/.codex/generated_images/result.png";
    await act(async () =>
      root.render(
        createElement(AssistantRunArtifacts, {
          activities: [activity("image-start", imagePath), activity("image-complete", imagePath), activity("text", "/tmp/result.txt")],
        }),
      ),
    );

    const images = container.querySelectorAll("img");
    expect(images).toHaveLength(1);
    expect(images[0].getAttribute("src")).toBe(`asset:${imagePath}`);
    expect(container.querySelector('[data-slot="assistant-run-artifacts"]')).not.toBeNull();
  });
});
