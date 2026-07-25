// @vitest-environment happy-dom

import { act, createElement, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantThread } from "@/features/assistant/components/AssistantThread";
import {
  ASSISTANT_COMPOSER_PLACEHOLDER_INTERVAL_MS,
  ASSISTANT_COMPOSER_PLACEHOLDERS,
} from "@/features/assistant/constants/assistantComposer";
import type { AiAction, AiChangeSet, ChatMessage, WritingProject, WritingSheet } from "@/shared/types";

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
    expect(renderedMessages[0].textContent).toContain("正文已修改");
    expect(renderedMessages[0].textContent).toContain("第一轮修改结果");
    expect(renderedMessages[0].querySelector('[data-slot="assistant-structured-card"] .lucide-circle-check')).not.toBeNull();
    expect(renderedMessages[0].querySelector('button[data-variant="outline"] .lucide-eye')).toBeNull();
    expect(
      Array.from(renderedMessages[0].querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent === "撤销")?.dataset
        .variant,
    ).toBe("destructive");
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
    expect(composer?.className).toContain("mt-3");
    expect(composer?.className).toContain("mb-1");
    expect(composer?.className).toContain("p-2.5");
    expect(inputGroup?.className).toContain("gap-0");
    expect(toolbar?.className).toContain("h-7");
    expect(textarea?.getAttribute("rows")).toBe("2");
    expect(textarea?.className).toContain("min-h-[2lh]");
    expect(textarea?.className).toContain("px-0");
    expect(textarea?.className).toContain("py-0");
    expect(textarea?.className).toContain("placeholder:text-muted-foreground/65");
    expect(sendButton?.className).toContain("rounded-full");
    expect(sendButton?.className).toContain("bg-foreground");
    expect(sendButton?.className).toContain("text-background");
    expect(sendButton?.hasAttribute("data-assistant-send-button")).toBe(true);
    expect(sendButton?.disabled).toBe(true);
    expect(sendButton?.querySelector(".lucide-arrow-up")).not.toBeNull();
    expect(container.querySelector('[data-slot="assistant-thread-bottom-fade"]')).toBeNull();
  });

  it("anchors each active turn at the latest user message", async () => {
    await act(async () => {
      root.render(
        createElement(AssistantThread, {
          ...threadProps([
            { id: "assistant-previous", role: "assistant", content: "上一轮回复" },
            { id: "user-current", role: "user", content: "请继续优化这一段" },
            { id: "assistant-current", role: "assistant", content: "" },
          ]),
          busy: true,
        }),
      );
    });

    const viewport = container.querySelector<HTMLElement>('[data-slot="assistant-thread-viewport"]');
    const userAnchor = container.querySelector<HTMLElement>("[data-aui-top-anchor-user]");
    const assistantTarget = container.querySelector<HTMLElement>("[data-aui-top-anchor-target]");

    expect(viewport?.className).toContain("mt-12.5");
    expect(viewport?.className).not.toContain("mt-15.25");
    expect(viewport?.className).not.toContain("pt-15.25");
    expect(userAnchor?.dataset.messageId).toBe("user-current");
    expect(userAnchor?.textContent).toContain("请继续优化这一段");
    expect(assistantTarget?.dataset.messageId).toBe("assistant-current");
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
    expect(cancelButton?.querySelector<SVGElement>(".lucide-square")?.getAttribute("class")).toContain("size-2.5");

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

  it("shows complete action artifacts before compact confirmations and persistent receipts", async () => {
    const proposedText =
      "# 文章开头\n\n真正让写作变得困难的，往往不是缺少工具，而是思路在工具之间不断被打断。好的写作软件应该帮助作者保留上下文，并把注意力重新放回文字本身。";
    const proposed = action({
      id: "action-proposed",
      status: "proposed",
      title: "插入文章开头",
      payload: { target: "end", text: proposedText },
    });
    const applied = action({
      id: "action-applied",
      status: "applied",
      title: "插入文章结尾",
      payload: { target: "end", text: "这是完整的文章结尾。" },
      result: "已写入正文",
    });
    const failed = action({
      id: "action-failed",
      status: "failed",
      title: "插入过渡段",
      payload: { target: "end", text: "这是等待重试的过渡段。" },
      error: "无法定位插入位置。",
    });
    const rejected = action({
      id: "action-rejected",
      status: "rejected",
      title: "插入补充说明",
      payload: { target: "end", text: "这是用户取消后仍保留的生成内容。" },
    });

    await act(async () => {
      root.render(
        createElement(AssistantThread, {
          ...threadProps([
            { id: "assistant-actions", role: "assistant", content: "我准备了几个动作。", actions: [proposed, applied, failed, rejected] },
          ]),
        }),
      );
    });

    const proposedArtifact = container.querySelector<HTMLElement>(
      '[data-slot="assistant-action-artifact"][data-action-id="action-proposed"]',
    );
    expect(proposedArtifact?.textContent).toContain("文章开头");
    expect(proposedArtifact?.textContent).toContain("把注意力重新放回文字本身");
    expect(proposedArtifact?.className).not.toContain("line-clamp");

    const proposedCard = container.querySelector<HTMLElement>('[data-action-status="proposed"]');
    expect(proposedCard?.dataset.actionView).toBe("confirmation");
    expect(proposedCard?.textContent).toContain("确认插入");
    expect(proposedCard?.textContent).toContain("将生成的文字插入到文稿末尾");
    expect(proposedCard?.textContent).not.toContain("文稿」");
    expect(proposedCard?.textContent).toContain("取消");
    expect(proposedCard?.textContent).toContain("确认");
    expect(
      Array.from(proposedCard?.querySelectorAll("button") ?? []).find((button) => button.textContent === "取消")?.dataset.variant,
    ).toBe("outline");
    expect(proposedCard?.textContent).not.toContain("把注意力重新放回文字本身");
    expect(proposedCard?.textContent).not.toContain("建议插入正文");

    const appliedCard = container.querySelector<HTMLElement>('[data-action-status="applied"]');
    expect(appliedCard?.dataset.actionView).toBe("receipt");
    expect(appliedCard?.textContent).toBe("已插入到「文稿」");
    expect(appliedCard?.textContent).not.toContain("已写入正文");
    expect(container.querySelector('[data-action-id="action-applied"]')?.textContent).toContain("这是完整的文章结尾");

    const failedCard = container.querySelector<HTMLElement>('[data-action-status="failed"]');
    expect(failedCard?.dataset.actionView).toBe("confirmation");
    expect(failedCard?.textContent).toContain("插入失败");
    expect(failedCard?.textContent).toContain("将生成的文字插入到文稿末尾");
    expect(failedCard?.textContent).toContain("无法定位插入位置。");
    expect(failedCard?.textContent).toContain("取消");
    expect(failedCard?.textContent).toContain("重试");
    expect(failedCard?.textContent).not.toContain("这是等待重试的过渡段");

    const rejectedCard = container.querySelector<HTMLElement>('[data-action-status="rejected"]');
    expect(rejectedCard?.dataset.actionView).toBe("receipt");
    expect(rejectedCard?.textContent).toBe("已取消：插入到「文稿」");
    expect(container.querySelector('[data-action-id="action-rejected"]')?.textContent).toContain("用户取消后仍保留的生成内容");
  });

  it("shows a generated image in the message flow instead of inside its confirmation", async () => {
    const imageAction = action({
      id: "action-image",
      type: "insertImage",
      title: "插入图片：远山",
      payload: { target: "end", path: "https://example.com/mountains.png", alt: "雾气中的远山", format: "markdown" },
    });

    await act(async () => {
      root.render(
        createElement(AssistantThread, {
          ...threadProps([
            { id: "assistant-image", role: "assistant", content: "图片已经生成，可以先查看完整结果。", actions: [imageAction] },
          ]),
        }),
      );
    });

    const artifact = container.querySelector<HTMLElement>('[data-action-id="action-image"]');
    expect(artifact?.querySelector("img")?.getAttribute("src")).toBe("https://example.com/mountains.png");
    expect(artifact?.querySelector("img")?.getAttribute("alt")).toBe("雾气中的远山");

    const confirmation = container.querySelector<HTMLElement>('[data-action-status="proposed"]');
    expect(confirmation?.textContent).toContain("确认插入");
    expect(confirmation?.textContent).toContain("将生成的图片插入到文稿末尾");
    expect(confirmation?.textContent).not.toContain("文稿」");
    expect(confirmation?.textContent).not.toContain("https://example.com/mountains.png");
  });

  it("uses fixed request titles and action-specific secondary descriptions", async () => {
    const actions: AiAction[] = [
      action({ id: "confirm-selection", payload: { target: "selection", text: "替换后的内容" } }),
      action({
        id: "confirm-create",
        type: "createSheet",
        title: "创建文稿：素材卡",
        payload: { title: "素材卡", body: "卡片正文" },
        targetSheetId: undefined,
        targetSheetTitle: undefined,
      }),
      action({
        id: "confirm-export",
        type: "saveExport",
        title: "保存导出：终稿.md",
        payload: { filename: "终稿.md", content: "# 终稿" },
        targetSheetId: undefined,
        targetSheetTitle: undefined,
      }),
    ];

    await act(async () => {
      root.render(
        createElement(AssistantThread, {
          ...threadProps([{ id: "assistant-request-types", role: "assistant", content: "请确认以下操作。", actions }]),
        }),
      );
    });

    const selection = container.querySelector<HTMLElement>('[data-action-view="confirmation"][data-action-id="confirm-selection"]');
    const create = container.querySelector<HTMLElement>('[data-action-view="confirmation"][data-action-id="confirm-create"]');
    const exportCard = container.querySelector<HTMLElement>('[data-action-view="confirmation"][data-action-id="confirm-export"]');

    expect(selection?.textContent).toContain("确认插入");
    expect(selection?.textContent).toContain("使用生成的文字替换当前选区");
    expect(create?.textContent).toContain("确认创建");
    expect(create?.textContent).toContain("创建新文稿「素材卡」");
    expect(exportCard?.textContent).toContain("确认导出");
    expect(exportCard?.textContent).toContain("将生成的内容导出为「终稿.md」");
  });

  it("does not duplicate an artifact already present in the assistant message", async () => {
    const generatedText = "这段生成内容已经由消息正文完整展示。";
    const textAction = action({ id: "action-deduplicated", payload: { target: "end", text: generatedText } });

    await act(async () => {
      root.render(
        createElement(AssistantThread, {
          ...threadProps([{ id: "assistant-deduplicated", role: "assistant", content: generatedText, actions: [textAction] }]),
        }),
      );
    });

    expect(container.querySelector('[data-slot="assistant-action-artifacts"]')).toBeNull();
    expect(container.textContent?.match(new RegExp(generatedText, "g"))).toHaveLength(1);
    expect(container.querySelector('[data-action-status="proposed"]')).toBeTruthy();
  });
});

function action(overrides: Partial<AiAction>): AiAction {
  return {
    id: "action",
    type: "insertText",
    status: "proposed",
    title: "插入正文",
    summary: "建议插入正文",
    payload: { target: "end", text: "一段简洁的示例正文" },
    createdAt: "2026-07-23T10:00:00.000Z",
    targetProjectId: project.id,
    targetProjectTitle: project.title,
    targetSheetId: sheet.id,
    targetSheetTitle: sheet.title,
    ...overrides,
  };
}

function threadProps(messages: ChatMessage[]): ComponentProps<typeof AssistantThread> {
  return {
    messages,
    libraryPath: "/Users/example/Loby",
    projects: [project],
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
