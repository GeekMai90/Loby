// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React DOM、Vitest、AI 面板 host 与最小文稿上下文契约
 * [OUTPUT]: 验证 assistant feature 持有 AI 面板 lazy 边界，并完整透传当前文稿与展示形态
 * [POS]: assistant 面板 surface host 的组合回归测试
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AiAssistantPanelProps } from "@/features/assistant/components/AiAssistantPanel";
import { AiAssistantPanelHost } from "@/features/assistant/components/AiAssistantPanelHost";
import type { AssistantPresentation, WritingSheet } from "@/shared/types";

vi.mock("@/features/assistant/components/AiAssistantPanel", () => ({
  AiAssistantPanel: ({ activeSheet, presentation }: AiAssistantPanelProps) =>
    createElement("div", { "data-testid": "ai-assistant-panel", "data-sheet-id": activeSheet.id }, presentation),
}));

describe("AiAssistantPanelHost", () => {
  afterEach(() => document.body.replaceChildren());

  it("keeps the AI panel lazy boundary inside the assistant feature", async () => {
    const activeSheet = { id: "sheet-1" } as WritingSheet;
    const props = {
      activeSheet,
      presentation: "docked" as AssistantPresentation,
    } as AiAssistantPanelProps;
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => root.render(createElement(AiAssistantPanelHost, props)));

    expect(container.querySelector('[data-testid="ai-assistant-panel"]')?.getAttribute("data-sheet-id")).toBe(activeSheet.id);
    expect(container.textContent).toContain("docked");

    await act(async () => root.unmount());
  });
});
