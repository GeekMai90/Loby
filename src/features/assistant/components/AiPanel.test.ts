/**
 * [INPUT]: 依赖 React DOM 测试运行时、Vitest、AiPanel 与会话消息契约
 * [OUTPUT]: 验证活动会话变化会重建 assistant runtime 所属子树
 * [POS]: AI 助手界面组合层的会话生命周期回归测试，覆盖长短历史记录连续切换
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
// @vitest-environment happy-dom

import { act, createElement, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AiPanel } from "@/features/assistant/components/AiPanel";
import type { ChatConversation, ChatMessage } from "@/shared/types";

vi.mock("@/features/assistant/components/AssistantThread", async () => {
  const { Component, createElement: createReactElement } = await import("react");

  interface StubProps {
    messages: ChatMessage[];
  }

  class AssistantThread extends Component<StubProps> {
    private readonly initialMessageCount = this.props.messages.length;

    render() {
      if (this.props.messages.length < this.initialMessageCount) {
        throw new Error(`stale runtime index ${this.initialMessageCount - 1}`);
      }
      return createReactElement(
        "div",
        { "data-slot": "assistant-thread-stub" },
        this.props.messages.map((message) => message.content).join(" | "),
      );
    }
  }

  return { AssistantThread };
});

describe("AiPanel", () => {
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

  it("remounts the message runtime when switching from a longer history to a shorter one", async () => {
    const longMessages = messages("long", 4);
    const shortMessages = messages("short", 2);

    await act(async () => {
      root.render(createElement(AiPanel, panelProps("conversation-long", longMessages)));
    });
    expect(container.querySelector('[data-slot="assistant-thread-stub"]')?.textContent).toContain("long-4");

    await act(async () => {
      root.render(createElement(AiPanel, panelProps("conversation-short", shortMessages)));
    });

    const thread = container.querySelector('[data-slot="assistant-thread-stub"]');
    expect(thread?.textContent).toBe("short-1 | short-2");
    expect(container.querySelector('[data-slot="assistant-error-fallback"]')).toBeNull();
  });
});

function messages(prefix: string, count: number): ChatMessage[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${index + 1}`,
    role: index % 2 === 0 ? "user" : "assistant",
    content: `${prefix}-${index + 1}`,
  }));
}

function panelProps(activeConversationId: string, activeMessages: ChatMessage[]): ComponentProps<typeof AiPanel> {
  const now = "2026-07-27T00:00:00.000Z";
  const conversations: ChatConversation[] = [
    { id: activeConversationId, title: "测试会话", messages: activeMessages, createdAt: now, updatedAt: now },
  ];

  return {
    messages: activeMessages,
    libraryPath: "/Users/example/Loby",
    projects: [],
    conversations,
    activeConversationId,
    busy: false,
    mountedContexts: [],
    skills: [],
    quickPrompts: [],
    quickPromptsReady: true,
    documents: [],
    modelCatalog: null,
    agentModel: "auto",
    agentReasoningEffort: "medium",
    agentQuickMode: false,
    assistantSendMode: "enter",
    approvalRequests: [],
    shownChangeSetIds: [],
    onSelectConversation: vi.fn(),
    onCreateConversation: vi.fn(),
    onDeleteConversation: vi.fn(),
    onRenameConversation: vi.fn(),
    onDetachMountedContext: vi.fn(),
    onAttachDocument: vi.fn(),
    onAgentModelChange: vi.fn(),
    onAgentReasoningEffortChange: vi.fn(),
    onAgentQuickModeChange: vi.fn(),
    onRespondApproval: vi.fn(),
    onShowChanges: vi.fn(),
    onHideChanges: vi.fn(),
    onRollbackChangeSet: vi.fn(),
    onRejectChangeSet: vi.fn(),
    onOpenChangeSetTarget: vi.fn(),
    onApplyAction: vi.fn(),
    onRejectAction: vi.fn(),
    onRevertAction: vi.fn(),
    onOpenActionTarget: vi.fn(),
    onOpenQuickPromptSettings: vi.fn(),
    onClose: vi.fn(),
    presentation: "docked",
    onTogglePresentation: vi.fn(),
    dockedByDefault: true,
    onDockedByDefaultChange: vi.fn(),
    onCancel: vi.fn(),
    onEditUserMessage: vi.fn(),
    onSendText: vi.fn(),
    onSteerText: vi.fn(),
  };
}
