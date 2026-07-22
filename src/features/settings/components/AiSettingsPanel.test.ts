// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AiQuickPrompt } from "@/shared/types";
import { MAX_AI_QUICK_PROMPTS } from "@/features/assistant/model/quickPrompts";
import { AiSettingsPanel } from "@/features/settings/components/AiSettingsPanel";

describe("AiSettingsPanel quick prompts", () => {
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

  it("shows saved prompt titles and disables creation at the 20 item limit", async () => {
    const prompts = Array.from({ length: MAX_AI_QUICK_PROMPTS }, (_, index) => quickPrompt(index));
    await act(async () => root.render(createElement(AiSettingsPanel, panelProps(prompts))));

    expect(container.textContent).toContain(`已创建 ${MAX_AI_QUICK_PROMPTS}/${MAX_AI_QUICK_PROMPTS} 条`);
    expect(container.textContent).toContain("提示 1");
    expect(container.textContent).toContain("跟随窗口大小");
    const createButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("新建"));
    expect(createButton?.disabled).toBe(true);
  });
});

function panelProps(quickPrompts: AiQuickPrompt[]) {
  return {
    assistantSendMode: "enter" as const,
    assistantPresentationPreference: "auto" as const,
    codexCliPath: "",
    probeStatus: "未检测",
    probeDetail: "",
    probeBusy: false,
    quickPrompts,
    quickPromptsReady: true,
    onAssistantSendModeChange: vi.fn(),
    onAssistantPresentationPreferenceChange: vi.fn(),
    onCodexCliPathChange: vi.fn(),
    onRunAgentProbe: vi.fn(),
    onAddQuickPrompt: vi.fn(),
    onEditQuickPrompt: vi.fn(),
    onDeleteQuickPrompt: vi.fn(),
    onMoveQuickPrompt: vi.fn(),
  };
}

function quickPrompt(index: number): AiQuickPrompt {
  return {
    id: `prompt-${index}`,
    title: `提示 ${index + 1}`,
    content: `提示内容 ${index + 1}`,
    createdAt: "2026-07-19T00:00:00.000Z",
    updatedAt: "2026-07-19T00:00:00.000Z",
  };
}
