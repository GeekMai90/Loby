// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantComposer } from "./AssistantComposer";
import { WechatThemeAssistantPanel } from "./WechatThemeAssistantPanel";
import type { WechatThemeConversation } from "../lib/publishing/wechatThemeStore";

const { invoke } = vi.hoisted(() => ({
  invoke: vi.fn(async (_command: string, args: Record<string, unknown>) => ({
    id: `/tmp/loby-ai/${String(args.filename)}`,
    name: String(args.filename),
    path: `/tmp/loby-ai/${String(args.filename)}`,
    mimeType: String(args.mimeType),
    sizeBytes: (args.bytes as number[]).length,
  })),
}));

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (path: string) => `asset:${path}`,
  invoke,
}));

describe("AI composer image paste", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:loby-preview");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    invoke.mockClear();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("intercepts pasted images in the main assistant and sends an attachment instead of path text", async () => {
    const onSendText = vi.fn();
    await act(async () => {
      root.render(
        createElement(AssistantComposer, {
          busy: false,
          mountedContexts: [],
          skills: [],
          quickPrompts: [],
          documents: [],
          modelCatalog: null,
          agentModel: "auto",
          agentReasoningEffort: "medium",
          agentQuickMode: false,
          assistantSendMode: "enter",
          onDetachMountedContext: vi.fn(),
          onAttachDocument: vi.fn(),
          onAgentModelChange: vi.fn(),
          onAgentReasoningEffortChange: vi.fn(),
          onAgentQuickModeChange: vi.fn(),
          onCancel: vi.fn(),
          onSendText,
          onSteerText: vi.fn(),
        }),
      );
    });

    const textarea = container.querySelector("textarea")!;
    expect(textarea.closest('[data-slot="assistant-composer-shell"]')).not.toBeNull();
    const paste = pastedImageEvent(new File([new Uint8Array([1, 2, 3])], "main.png", { type: "image/png" }));
    await act(async () => {
      textarea.dispatchEvent(paste);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(paste.defaultPrevented).toBe(true);
    expect(textarea.value).toBe("");
    expect(container.querySelector('img[alt="main.png"]')).not.toBeNull();

    await act(async () => container.querySelector<HTMLButtonElement>('button[title="发送"]')!.click());
    expect(onSendText).toHaveBeenCalledWith("", [], [expect.objectContaining({ name: "main.png" })]);
  });

  it("intercepts pasted images in the theme assistant and sends the temporary attachment", async () => {
    const onSend = vi.fn();
    await act(async () => {
      root.render(
        createElement(WechatThemeAssistantPanel, {
          ...themeConversationProps(),
          messages: [],
          busy: false,
          modelCatalog: null,
          agentModel: "auto",
          agentReasoningEffort: "medium",
          agentQuickMode: false,
          onModelChange: vi.fn(),
          onReasoningEffortChange: vi.fn(),
          onQuickModeChange: vi.fn(),
          onSend,
        }),
      );
    });

    const textarea = container.querySelector("textarea")!;
    const panel = container.querySelector<HTMLElement>('[data-slot="wechat-theme-assistant-panel"]');
    const header = container.querySelector<HTMLElement>('[data-slot="assistant-panel-header"]');
    const viewport = container.querySelector<HTMLElement>('[data-slot="assistant-thread-viewport"]');
    const composer = textarea.closest<HTMLElement>('[data-slot="assistant-composer-shell"]');
    const inputGroup = composer?.querySelector<HTMLElement>('[data-slot="assistant-composer-input-group"]');
    const attachmentButton = composer?.querySelector<HTMLButtonElement>('button[title="添加图片"]');
    expect(panel?.className).toContain("[--assistant-panel-gutter:10px]");
    expect(panel?.classList.contains("overflow-hidden")).toBe(true);
    expect(header?.textContent).toContain("新对话");
    expect(header?.className).toContain("px-[var(--assistant-panel-gutter)]");
    expect(viewport?.className).toContain("px-[var(--assistant-panel-gutter)]");
    expect(viewport?.className).not.toContain("-mr-2");
    expect(composer?.className).toContain("mx-[var(--assistant-panel-gutter)]");
    expect(composer?.className).toContain("mb-1");
    expect(composer?.className).toContain("pr-2.5");
    expect(composer?.className).toContain("pb-2.5");
    expect(inputGroup?.className).toContain("gap-0");
    expect(textarea.getAttribute("rows")).toBe("2");
    expect(textarea.className).toContain("min-h-[calc(2lh+0.5rem)]");
    expect(textarea.className).toContain("placeholder:text-muted-foreground/65");
    expect(attachmentButton?.querySelector(".lucide-plus")).not.toBeNull();
    expect(container.querySelector('[data-slot="assistant-empty-state"] .assistant-launcher-glass')).not.toBeNull();
    expect(container.querySelector('[data-slot="assistant-empty-state"] .shiny-text')?.textContent).toBe("✨ 直接描述你想要的样子");
    const paste = pastedImageEvent(new File([new Uint8Array([1, 2, 3])], "theme.png", { type: "image/png" }));
    await act(async () => {
      textarea.dispatchEvent(paste);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(paste.defaultPrevented).toBe(true);
    expect(container.querySelector('img[alt="theme.png"]')).not.toBeNull();

    await act(async () => container.querySelector<HTMLButtonElement>('button[title="发送"]')!.click());
    expect(onSend).toHaveBeenCalledWith("", [expect.objectContaining({ name: "theme.png" })]);
  });

  it("uses the shared main-assistant message surfaces in the theme assistant", async () => {
    await act(async () => {
      root.render(
        createElement(WechatThemeAssistantPanel, {
          ...themeConversationProps(),
          messages: [
            { id: "user-1", role: "user", content: "标题再克制一点" },
            { id: "assistant-1", role: "assistant", content: "已降低标题的视觉重量。" },
          ],
          busy: false,
          modelCatalog: null,
          agentModel: "auto",
          agentReasoningEffort: "medium",
          agentQuickMode: false,
          onModelChange: vi.fn(),
          onReasoningEffortChange: vi.fn(),
          onQuickModeChange: vi.fn(),
          onSend: vi.fn(),
        }),
      );
    });

    const messages = container.querySelectorAll('[data-slot="assistant-message"]');
    expect(messages).toHaveLength(2);
    expect(messages[0].querySelector('[class*="assistant-user-message-bg"]')?.textContent).toBe("标题再克制一点");
    expect(messages[1].textContent).toBe("已降低标题的视觉重量。");
    expect(messages[1].className).toContain("bg-transparent");
  });

  it("shows the main-assistant run steps and cancellation control in the theme assistant", async () => {
    const onCancel = vi.fn();
    await act(async () => {
      root.render(
        createElement(WechatThemeAssistantPanel, {
          ...themeConversationProps(),
          messages: [
            { id: "user-1", role: "user", content: "让标题更醒目" },
            {
              id: "assistant-1",
              role: "assistant",
              content: "",
              run: {
                status: "running",
                activities: [
                  {
                    id: "reasoning-1",
                    rawType: "item/reasoning/textDelta",
                    title: "思考过程",
                    status: "in_progress",
                    command: "",
                    output: "正在检查当前标题层级",
                    text: "",
                    exitCode: null,
                  },
                ],
                usage: null,
              },
            },
          ],
          busy: true,
          modelCatalog: null,
          agentModel: "auto",
          agentReasoningEffort: "medium",
          agentQuickMode: false,
          onModelChange: vi.fn(),
          onReasoningEffortChange: vi.fn(),
          onQuickModeChange: vi.fn(),
          onSend: vi.fn(),
          onCancel,
        }),
      );
    });

    const runButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("正在思考"));
    expect(runButton).toBeDefined();
    await act(async () => runButton!.click());
    expect(container.textContent).toContain("正在检查当前标题层级");

    const cancelButton = container.querySelector<HTMLButtonElement>('button[title="取消"]');
    expect(cancelButton).not.toBeNull();
    await act(async () => cancelButton!.click());
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("reuses the main assistant conversation history and new-chat controls", async () => {
    const onCreateConversation = vi.fn();
    await act(async () => {
      root.render(
        createElement(WechatThemeAssistantPanel, {
          ...themeConversationProps(),
          conversations: [
            { ...themeConversationProps().conversations[0], id: "chat-1", title: "调整标题" },
            { ...themeConversationProps().conversations[0], id: "chat-2", title: "调整配色" },
          ],
          activeConversationId: "chat-2",
          messages: [{ id: "user-1", role: "user", content: "换成墨绿色" }],
          busy: false,
          modelCatalog: null,
          agentModel: "auto",
          agentReasoningEffort: "medium",
          agentQuickMode: false,
          onModelChange: vi.fn(),
          onReasoningEffortChange: vi.fn(),
          onQuickModeChange: vi.fn(),
          onSend: vi.fn(),
          onCreateConversation,
        }),
      );
    });

    expect(container.querySelector('[data-slot="assistant-panel-header"]')?.textContent).toContain("调整配色");
    const newConversationButton = container.querySelector<HTMLButtonElement>('button[title="新对话"]');
    expect(newConversationButton).not.toBeNull();
    await act(async () => newConversationButton!.click());
    expect(onCreateConversation).toHaveBeenCalledOnce();
    expect(container.querySelector<HTMLButtonElement>('button[title="更多"]')).not.toBeNull();
  });
});

function themeConversationProps() {
  const conversation = {
    id: "chat-1",
    title: "新对话",
    messages: [],
    createdAt: "2026-07-17T00:00:00.000Z",
    updatedAt: "2026-07-17T00:00:00.000Z",
  } satisfies WechatThemeConversation;
  return {
    conversations: [conversation],
    activeConversationId: conversation.id,
    onSelectConversation: vi.fn(),
    onCreateConversation: vi.fn(),
    onDeleteConversation: vi.fn(),
    onRenameConversation: vi.fn(),
  };
}

function pastedImageEvent(file: File): Event {
  const event = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clipboardData", {
    value: {
      items: [{ kind: "file", type: file.type, getAsFile: () => file }],
      files: [file],
    },
  });
  return event;
}
