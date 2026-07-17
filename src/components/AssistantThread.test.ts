// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AiChangeSet, ChatMessage } from "../types";
import { AssistantThread } from "./AssistantThread";

describe("AssistantThread", () => {
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

  it("keeps a persisted change review card inside the assistant message that created it", async () => {
    const changeSet = reviewChangeSet();
    const messages: ChatMessage[] = [
      { id: "user-1", role: "user", content: "检查错别字" },
      { id: "assistant-1", role: "assistant", content: "已完成轻度校对。", changeSets: [changeSet] },
      { id: "user-2", role: "user", content: "继续生成封面" },
      { id: "assistant-2", role: "assistant", content: "正在整理思路。" },
    ];

    await act(async () => {
      root.render(createElement(AssistantThread, assistantThreadProps(messages)));
    });

    const renderedMessages = container.querySelectorAll<HTMLElement>("[data-message-id]");
    const reviewPanel = container.querySelector<HTMLElement>('[data-slot="ai-change-review-panel"]');

    expect(renderedMessages).toHaveLength(4);
    expect(reviewPanel).not.toBeNull();
    expect(renderedMessages[1].textContent).toContain("已完成轻度校对。");
    expect(renderedMessages[1].textContent).toContain(changeSet.summary);
    expect(renderedMessages[1].contains(reviewPanel)).toBe(true);
    expect(renderedMessages[2].textContent).toContain("继续生成封面");
    expect(renderedMessages[2].contains(reviewPanel)).toBe(false);
  });
});

function assistantThreadProps(messages: ChatMessage[]) {
  return {
    messages,
    libraryPath: "browser://libraries/default",
    busy: false,
    mountedContexts: [],
    skills: [],
    documents: [],
    modelCatalog: null,
    agentModel: "auto" as const,
    agentReasoningEffort: "medium" as const,
    agentQuickMode: false,
    assistantSendMode: "enter" as const,
    approvalRequests: [],
    shownChangeSetIds: [],
    activeSheetId: "sheet-1",
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
    onCancel: vi.fn(),
    onEditUserMessage: vi.fn(),
    onSendText: vi.fn(),
  };
}

function reviewChangeSet(): AiChangeSet {
  return {
    id: "change-set-1",
    sheetId: "sheet-1",
    status: "accepted",
    createdAt: "2026-07-17T22:00:00+08:00",
    summary: "修正错别字、重复表述和不顺句",
    baseBody: "原文",
    proposedBody: "修改后的正文",
    changes: [
      {
        id: "change-1",
        status: "accepted",
        fromText: "原文",
        toText: "修改后的正文",
        reason: "修正错别字，并让句子更自然。",
        anchor: {},
      },
    ],
  };
}
