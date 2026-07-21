// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextWordCountMilestone, resolveAssistantGoalMotionState, WORD_COUNT_AUTO_REVEAL_DURATION_MS } from "../lib/assistantLauncher";
import { AiAssistantLauncher } from "./AiAssistantLauncher";
import { AiPanelHeader } from "./AiPanelHeader";
import { InspectorPanel } from "./InspectorPanel";

describe("assistant presentation controls", () => {
  it("labels the launcher and both presentation-switch directions", () => {
    const handler = vi.fn();
    const launcherHtml = renderToStaticMarkup(
      createElement(AiAssistantLauncher, { sheetId: "sheet-1", wordCount: 1284, targetWords: 1500, onOpen: handler }),
    );
    const floatingHeaderHtml = renderToStaticMarkup(
      createElement(AiPanelHeader, {
        messages: [{ role: "user", content: "你好" }],
        conversations: [{ id: "conversation", title: "默认对话" }],
        activeConversationId: "conversation",
        presentation: "floating",
        onSelectConversation: handler,
        onCreateConversation: handler,
        onDeleteConversation: handler,
        onRenameConversation: handler,
        onTogglePresentation: handler,
        onClose: handler,
      }),
    );
    const dockedHeaderHtml = renderToStaticMarkup(
      createElement(AiPanelHeader, {
        messages: [],
        conversations: [{ id: "conversation", title: "默认对话" }],
        activeConversationId: "conversation",
        presentation: "docked",
        onSelectConversation: handler,
        onCreateConversation: handler,
        onDeleteConversation: handler,
        onRenameConversation: handler,
        onTogglePresentation: handler,
        onClose: handler,
      }),
    );

    expect(launcherHtml).toContain('aria-label="打开 AI 助手，当前文稿 1,284 字"');
    expect(launcherHtml).toContain('class="assistant-launcher-glass"');
    expect(launcherHtml).toContain('class="assistant-launcher-fluid"');
    expect(launcherHtml).not.toContain("title=");
    expect(launcherHtml).not.toContain("assistant-word-count");
    expect(launcherHtml).not.toContain("<span>AI 助手</span>");
    expect(launcherHtml).toContain('data-goal-state="near"');
    expect(floatingHeaderHtml).toContain('aria-label="切换到右侧边栏"');
    expect(floatingHeaderHtml).toContain('title="新对话"');
    expect(dockedHeaderHtml).toContain('aria-label="切换到小窗"');
  });

  it("reveals only newly crossed hundred-word milestones", () => {
    expect(nextWordCountMilestone(99, 100, 0)).toBe(100);
    expect(nextWordCountMilestone(199, 245, 100)).toBe(200);
    expect(nextWordCountMilestone(245, 205, 200)).toBeNull();
    expect(nextWordCountMilestone(180, 205, 200)).toBeNull();
    expect(nextWordCountMilestone(0, 99, 0)).toBeNull();
  });

  it("maps writing-goal proximity to the original calm, breathing, and final-push states", () => {
    expect(resolveAssistantGoalMotionState(800, 1000)).toBe("active");
    expect(resolveAssistantGoalMotionState(850, 1000)).toBe("near");
    expect(resolveAssistantGoalMotionState(950, 1000)).toBe("final");
    expect(resolveAssistantGoalMotionState(1000, 1000)).toBe("complete");
    expect(resolveAssistantGoalMotionState(500, 0)).toBe("idle");
  });
});

describe("AI launcher word count reveal", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const renderLauncher = (wordCount: number) =>
    createElement(AiAssistantLauncher, {
      sheetId: "sheet-1",
      wordCount,
      targetWords: 1000,
      onOpen: vi.fn(),
    });

  it("reveals the current count only while the launcher is hovered", async () => {
    await act(async () => root.render(renderLauncher(141)));
    expect(container.querySelector(".assistant-word-count")).toBeNull();

    const control = container.querySelector<HTMLElement>(".assistant-launcher-control");
    await act(async () => control?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true })));

    expect(container.querySelector(".assistant-word-count")?.textContent).toBe("141 字");
    expect(container.querySelector(".assistant-launcher")?.hasAttribute("title")).toBe(false);

    await act(async () => control?.dispatchEvent(new MouseEvent("mouseout", { bubbles: true })));
    expect(container.querySelector(".assistant-launcher")?.hasAttribute("aria-describedby")).toBe(false);
  });

  it("reveals once after crossing a new hundred-word milestone and then hides", async () => {
    await act(async () => root.render(renderLauncher(99)));
    await act(async () => root.render(renderLauncher(100)));

    expect(container.querySelector(".assistant-word-count")?.textContent).toBe("100 字");
    expect(container.querySelector(".assistant-launcher")?.hasAttribute("aria-describedby")).toBe(true);

    await act(async () => vi.advanceTimersByTime(WORD_COUNT_AUTO_REVEAL_DURATION_MS + 500));
    expect(container.querySelector(".assistant-launcher")?.hasAttribute("aria-describedby")).toBe(false);

    await act(async () => root.render(renderLauncher(90)));
    await act(async () => root.render(renderLauncher(100)));
    expect(container.querySelector(".assistant-launcher")?.hasAttribute("aria-describedby")).toBe(false);
  });
});

describe("InspectorPanel presentation changes", () => {
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
    vi.unstubAllGlobals();
  });

  it("keeps the mounted assistant content while switching between floating and docked", async () => {
    const handler = vi.fn();
    const renderPanel = (presentation: "floating" | "docked") =>
      createElement(InspectorPanel, {
        presentation,
        ai: createElement("textarea", { defaultValue: "未发送的草稿", "aria-label": "测试草稿" }),
        onResizeStart: handler,
        onActivate: handler,
      });

    await act(async () => root.render(renderPanel("floating")));
    const draft = container.querySelector<HTMLTextAreaElement>('textarea[aria-label="测试草稿"]');
    expect(draft).not.toBeNull();
    if (!draft) return;
    draft.value = "切换后仍保留";

    await act(async () => root.render(renderPanel("docked")));

    expect(container.querySelector('textarea[aria-label="测试草稿"]')).toBe(draft);
    expect(draft.value).toBe("切换后仍保留");
    expect(container.querySelector(".assistant-surface--docked")).not.toBeNull();
    expect(container.querySelector(".inspector-resize-handle")).not.toBeNull();
  });
});
