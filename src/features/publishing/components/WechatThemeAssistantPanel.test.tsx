/**
 * [INPUT]: 依赖 React DOM、assistant-ui Runtime、公众号主题助手面板与主题会话消息契约
 * [OUTPUT]: 验证主题助手复用主助手的 top-anchor 消息定位，不退回普通静态滚动列表
 * [POS]: publishing/components 的主题助手滚动回归测试，保护最新用户消息与运行中回复的阅读几何
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
// @vitest-environment happy-dom

import { act, createElement, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WechatThemeAssistantPanel } from "@/features/publishing/components/WechatThemeAssistantPanel";
import type { WechatThemeConversationMessage } from "@/features/publishing/model/wechatThemeStore";

vi.mock("@/features/assistant/components/AiPanelHeader", async () => {
  const { createElement } = await import("react");
  return { AiPanelHeader: () => createElement("div", { "data-slot": "theme-header" }) };
});

vi.mock("@/features/assistant/components/AssistantComposer", async () => {
  const { createElement } = await import("react");
  return { AssistantComposer: () => createElement("div", { "data-slot": "theme-composer" }) };
});

describe("WechatThemeAssistantPanel", () => {
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

  it("anchors the latest user message and running response like the main assistant", async () => {
    const messages: WechatThemeConversationMessage[] = [
      { id: "assistant-previous", role: "assistant", content: "上一轮主题回复" },
      { id: "user-current", role: "user", content: "参考这个目录调整主题" },
      {
        id: "assistant-current",
        role: "assistant",
        content: "",
        run: { status: "running", activities: [], usage: null },
      },
    ];

    await act(async () => {
      root.render(createElement(WechatThemeAssistantPanel, panelProps(messages)));
    });

    const viewport = container.querySelector<HTMLElement>('[data-slot="assistant-thread-viewport"]');
    const userAnchor = container.querySelector<HTMLElement>("[data-aui-top-anchor-user]");
    const assistantTarget = container.querySelector<HTMLElement>("[data-aui-top-anchor-target]");

    expect(viewport?.className).toContain("mt-12.5");
    expect(userAnchor?.dataset.messageId).toBe("user-current");
    expect(assistantTarget?.dataset.messageId).toBe("assistant-current");
  });
});

function panelProps(messages: WechatThemeConversationMessage[]): ComponentProps<typeof WechatThemeAssistantPanel> {
  return {
    messages,
    conversations: [],
    activeConversationId: "theme-chat-1",
    busy: true,
    connections: [],
    agentProvider: "openai-api",
    agentModel: "auto",
    agentReasoningEffort: "medium",
    assistantSendMode: "enter",
    onAgentSelectionChange: vi.fn(),
    onSend: vi.fn(),
    onCancel: vi.fn(),
    onSteerText: vi.fn(),
    onSelectConversation: vi.fn(),
    onCreateConversation: vi.fn(),
    onDeleteConversation: vi.fn(),
    onRenameConversation: vi.fn(),
  };
}
