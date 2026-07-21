// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AiAssistantLauncher } from "./AiAssistantLauncher";
import { AiPanelHeader } from "./AiPanelHeader";
import { InspectorPanel } from "./InspectorPanel";

describe("assistant presentation controls", () => {
  it("labels the launcher and both presentation-switch directions", () => {
    const handler = vi.fn();
    const launcherHtml = renderToStaticMarkup(createElement(AiAssistantLauncher, { onOpen: handler }));
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

    expect(launcherHtml).toContain('aria-label="打开 AI 助手"');
    expect(launcherHtml).toContain("AI 助手");
    expect(floatingHeaderHtml).toContain('aria-label="切换到右侧边栏"');
    expect(floatingHeaderHtml).toContain('title="新对话"');
    expect(dockedHeaderHtml).toContain('aria-label="切换到小窗"');
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
