// @vitest-environment happy-dom

import { act, createElement, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantThread } from "@/features/assistant/components/AssistantThread";
import {
  ASSISTANT_COMPOSER_PLACEHOLDER_INTERVAL_MS,
  ASSISTANT_COMPOSER_PLACEHOLDERS,
} from "@/features/assistant/constants/assistantComposer";
import type { AiChangeSet, ChatMessage, WritingProject, WritingSheet } from "@/shared/types";

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (path: string) => `asset:${path}`,
  invoke: vi.fn(),
}));

const sheet: WritingSheet = {
  id: "sheet-1",
  title: "文稿",
  groupId: "group-1",
  status: "修改中",
  targetWords: 1000,
  summary: "",
  body: "修改后的正文",
  updatedAt: "2026-07-18",
};

const project: WritingProject = {
  id: "project-1",
  title: "项目",
  description: "",
  status: "修改中",
  targetPlatform: "未指定",
  targetWords: 1000,
  tags: [],
  groups: [{ id: "group-1", title: "待整理", icon: "article", iconColor: "#007aff", description: "" }],
  sheets: [sheet],
  updatedAt: "2026-07-18",
};

const changeSet: AiChangeSet = {
  id: "change-1",
  sheetId: sheet.id,
  status: "accepted",
  createdAt: "2026-07-18T13:00:00.000Z",
  summary: "第一轮修改结果",
  baseBody: "原正文",
  proposedBody: sheet.body,
  changes: [{ id: "block-1", status: "accepted", fromText: "原", toText: "修改后", anchor: {} }],
};

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
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("keeps a change review card inside the assistant message that created it", async () => {
    const messages: ChatMessage[] = [
      {
        id: "assistant-1",
        role: "assistant",
        content: "第一轮回复\n\n主要修改包括：\n\n- 修正错别字\n- 保留段落结构",
        changeSets: [changeSet],
      },
      {
        id: "user-2",
        role: "user",
        content: "第二轮问题",
        contexts: [{ id: "context-1", type: "document", title: "挂载文稿", subtitle: "", excerpt: "" }],
      },
      { id: "assistant-2", role: "assistant", content: "第二轮回复" },
    ];

    await act(async () => {
      root.render(createElement(AssistantThread, threadProps(messages)));
    });

    const renderedMessages = container.querySelectorAll<HTMLElement>('[data-slot="assistant-message"]');
    expect(renderedMessages).toHaveLength(3);
    expect(renderedMessages[0].textContent).toContain("第一轮回复");
    expect(renderedMessages[0].textContent).toContain("第一轮修改结果");
    expect(renderedMessages[0].querySelectorAll("ul > li")).toHaveLength(2);
    expect(renderedMessages[1].textContent).toContain("第二轮问题");
    expect(renderedMessages[1].textContent).not.toContain("第一轮修改结果");
    expect(renderedMessages[1].firstElementChild?.className).toContain("mb-2");
    expect(renderedMessages[1].querySelector<HTMLButtonElement>('button[title="编辑并重新发送"]')?.parentElement?.className).toContain(
      "h-3.5",
    );
    expect(renderedMessages[2].textContent).toContain("第二轮回复");
    expect(renderedMessages[2].textContent).not.toContain("第一轮修改结果");
  });

  it("fills the composer with stored prompt content from the empty conversation state", async () => {
    const onSendText = vi.fn();
    await act(async () => {
      root.render(
        createElement(AssistantThread, {
          ...threadProps([]),
          quickPrompts: [
            {
              id: "prompt-1",
              title: "润色当前文章",
              content: "请在保持原意的前提下润色当前文章。",
              createdAt: "2026-07-19T00:00:00.000Z",
              updatedAt: "2026-07-19T00:00:00.000Z",
            },
          ],
          onSendText,
        }),
      );
    });

    const promptButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("润色当前文章"));
    expect(promptButton).toBeTruthy();
    await act(async () => promptButton?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(container.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe("请在保持原意的前提下润色当前文章。");
    expect(onSendText).not.toHaveBeenCalled();
  });

  it("uses the shared panel gutter for the main assistant surfaces", async () => {
    await act(async () => {
      root.render(
        createElement(AssistantThread, {
          ...threadProps([]),
          approvalRequests: [
            {
              id: "approval-1",
              assistantMessageId: "assistant-1",
              title: "运行命令",
              command: "npm test",
              reason: "验证改动",
              status: "pending",
            },
          ],
        }),
      );
    });

    const viewport = container.querySelector<HTMLElement>('[data-slot="assistant-thread-viewport"]');
    const approvalDock = container.querySelector<HTMLElement>('[data-slot="assistant-approval-dock"]');
    const composer = container.querySelector<HTMLElement>('[data-slot="assistant-composer-shell"]');
    const inputGroup = composer?.querySelector<HTMLElement>('[data-slot="assistant-composer-input-group"]');
    const toolbar = composer?.querySelector<HTMLElement>('[data-slot="assistant-composer-toolbar"]');
    const textarea = composer?.querySelector<HTMLTextAreaElement>("textarea");
    const sendButton = composer?.querySelector<HTMLButtonElement>('button[title="发送"]');

    expect(viewport?.className).toContain("px-[var(--assistant-panel-gutter)]");
    expect(viewport?.className).not.toContain("-mr-2");
    expect(approvalDock?.className).toContain("px-[var(--assistant-panel-gutter)]");
    expect(composer?.className).toContain("mx-[var(--assistant-panel-gutter)]");
    expect(composer?.className).toContain("mb-1");
    expect(composer?.className).toContain("pr-2.5");
    expect(composer?.className).toContain("pb-2.5");
    expect(inputGroup?.className).toContain("gap-0");
    expect(toolbar?.className).toContain("min-h-8");
    expect(textarea?.getAttribute("rows")).toBe("2");
    expect(textarea?.className).toContain("min-h-[calc(2lh+0.5rem)]");
    expect(textarea?.className).toContain("pb-0");
    expect(textarea?.className).toContain("placeholder:text-muted-foreground/65");
    expect(sendButton?.className).toContain("rounded-full");
    expect(sendButton?.className).toContain("bg-foreground");
    expect(sendButton?.className).toContain("text-[var(--surface-canvas)]");
    expect(sendButton?.className).not.toContain("text-background");
    expect(sendButton?.hasAttribute("data-assistant-send-button")).toBe(true);
    expect(sendButton?.disabled).toBe(true);
    expect(sendButton?.querySelector(".lucide-arrow-up")).not.toBeNull();
  });

  it("loops the composer border glow only while the assistant is responding", async () => {
    await act(async () => {
      root.render(createElement(AssistantThread, { ...threadProps([]), busy: true }));
    });

    const composer = container.querySelector<HTMLElement>('[data-slot="assistant-composer-shell"]');
    const borderGlow = container.querySelector<HTMLElement>('[data-slot="border-glow"]');
    const cancelButton = composer?.querySelector<HTMLButtonElement>('button[title="取消"]');
    expect(composer?.dataset.glowActive).toBe("true");
    expect(borderGlow?.dataset.active).toBe("true");
    expect(cancelButton?.dataset.variant).toBe("default");
    expect(cancelButton?.className).toContain("bg-foreground");
    expect(cancelButton?.querySelector(".lucide-square")).not.toBeNull();

    await act(async () => {
      root.render(createElement(AssistantThread, threadProps([])));
    });

    expect(composer?.dataset.glowActive).toBe("false");
    expect(borderGlow?.dataset.active).toBe("false");
  });

  it("keeps the composer editable and sends text as steering during an active run", async () => {
    const onCancel = vi.fn();
    const onSteerText = vi.fn().mockResolvedValue(undefined);
    await act(async () => {
      root.render(createElement(AssistantThread, { ...threadProps([]), busy: true, onCancel, onSteerText }));
    });

    const textarea = container.querySelector<HTMLTextAreaElement>("textarea")!;
    expect(textarea.disabled).toBe(false);
    expect(textarea.placeholder).toBe("继续输入，引导 AI...");
    expect(container.querySelector<HTMLButtonElement>('button[title="取消"]')?.querySelector(".lucide-square")).not.toBeNull();

    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(textarea, "先保留现在的结构");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const steerButton = container.querySelector<HTMLButtonElement>('button[title="发送引导"]');
    expect(steerButton).not.toBeNull();
    expect(steerButton?.querySelector(".lucide-arrow-up")).not.toBeNull();
    await act(async () => steerButton!.click());

    expect(onSteerText).toHaveBeenCalledWith("先保留现在的结构");
    expect(onCancel).not.toHaveBeenCalled();
    expect(textarea.value).toBe("");
    expect(container.querySelector<HTMLButtonElement>('button[title="取消"]')?.querySelector(".lucide-square")).not.toBeNull();
  });

  it("rotates the empty composer placeholder while keeping a stable accessible label", async () => {
    vi.useFakeTimers();
    await act(async () => {
      root.render(createElement(AssistantThread, threadProps([])));
    });

    const textarea = container.querySelector<HTMLTextAreaElement>("textarea");
    expect(textarea?.placeholder).toBe(ASSISTANT_COMPOSER_PLACEHOLDERS[0]);
    expect(textarea?.getAttribute("aria-label")).toBe("给 AI 助手发送消息");

    await act(async () => {
      vi.advanceTimersByTime(ASSISTANT_COMPOSER_PLACEHOLDER_INTERVAL_MS);
    });

    expect(textarea?.placeholder).toBe(ASSISTANT_COMPOSER_PLACEHOLDERS[1]);
  });
});

function threadProps(messages: ChatMessage[]): ComponentProps<typeof AssistantThread> {
  return {
    messages,
    libraryPath: "/Users/example/Loby",
    activeProject: project,
    activeSheet: sheet,
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
    activeSheetId: sheet.id,
    onApplyAction: vi.fn(),
    onRejectAction: vi.fn(),
    onRevertAction: vi.fn(),
    onOpenActionTarget: vi.fn(),
    onOpenQuickPromptSettings: vi.fn(),
    onCancel: vi.fn(),
    onEditUserMessage: vi.fn(),
    onSendText: vi.fn(),
    onSteerText: vi.fn(),
  };
}
