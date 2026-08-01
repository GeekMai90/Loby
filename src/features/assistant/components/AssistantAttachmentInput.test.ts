// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantAttachments } from "@/features/assistant/components/AssistantAttachments";
import { AssistantComposer } from "@/features/assistant/components/AssistantComposer";
import { WechatThemeAssistantPanel } from "@/features/publishing/components/WechatThemeAssistantPanel";
import type { WechatThemeConversation } from "@/features/publishing/model/wechatThemeStore";

const { invoke } = vi.hoisted(() => ({
  invoke: vi.fn(async (_command: string, args: Record<string, unknown>) => ({
    id: `/tmp/loby-ai/${String(args.filename)}`,
    name: String(args.filename),
    path: `/tmp/loby-ai/${String(args.filename)}`,
    mimeType: String(args.mimeType),
    sizeBytes: (args.bytes as number[]).length,
    kind: String(args.mimeType).startsWith("image/") ? "image" : "document",
  })),
}));

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (path: string) => `asset:${path}`,
  invoke,
}));

describe("AI composer attachment input", () => {
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
          connections: [],
          agentProvider: "openai-api",
          agentModel: "auto",
          agentReasoningEffort: "medium",
          assistantSendMode: "enter",
          onDetachMountedContext: vi.fn(),
          onAttachDocument: vi.fn(),
          onAgentSelectionChange: vi.fn(),
          onCancel: vi.fn(),
          onSendText,
          onSteerText: vi.fn(),
        }),
      );
    });

    const textarea = container.querySelector("textarea")!;
    expect(textarea.closest('[data-slot="assistant-composer-shell"]')).not.toBeNull();
    const attachmentButton = container.querySelector<HTMLButtonElement>('button[title="添加附件"]');
    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(attachmentButton?.querySelector(".lucide-paperclip")).not.toBeNull();
    expect(fileInput?.accept).toContain("application/pdf");
    expect(fileInput?.accept).toContain(".pdf");
    expect(fileInput?.accept).toContain(".docx");
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

  it("adds a PDF from the main assistant file picker and sends it as a document attachment", async () => {
    const onSendText = vi.fn();
    await act(async () => {
      root.render(
        createElement(AssistantComposer, {
          busy: false,
          mountedContexts: [],
          skills: [],
          quickPrompts: [],
          documents: [],
          connections: [],
          agentProvider: "openai-api",
          agentModel: "auto",
          agentReasoningEffort: "medium",
          assistantSendMode: "enter",
          onDetachMountedContext: vi.fn(),
          onAttachDocument: vi.fn(),
          onAgentSelectionChange: vi.fn(),
          onCancel: vi.fn(),
          onSendText,
          onSteerText: vi.fn(),
        }),
      );
    });

    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    const pdf = new File([new Uint8Array([37, 80, 68, 70])], "brief.pdf", { type: "application/pdf" });
    Object.defineProperty(fileInput, "files", { configurable: true, value: [pdf] });
    await act(async () => {
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("brief.pdf");
    const pdfAttachment = container.querySelector<HTMLElement>('[title="brief.pdf"]');
    expect(pdfAttachment?.querySelector(".lucide-file-text")).not.toBeNull();
    expect(pdfAttachment?.querySelector(".lucide-clipboard-list")).toBeNull();
    expect(invoke).toHaveBeenCalledWith("save_ai_attachment", expect.objectContaining({ filename: "brief.pdf" }));
    await act(async () => container.querySelector<HTMLButtonElement>('button[title="发送"]')!.click());
    expect(onSendText).toHaveBeenCalledWith("", [], [expect.objectContaining({ name: "brief.pdf", kind: "document" })]);
  });

  it("keeps the paste icon when the native temp filename has a content hash suffix", async () => {
    await act(async () => {
      root.render(
        createElement(AssistantAttachments, {
          attachments: [
            {
              id: "/tmp/loby-ai/粘贴内容-d6d760e6.md",
              name: "粘贴内容-d6d760e6.md",
              path: "/tmp/loby-ai/粘贴内容-d6d760e6.md",
              mimeType: "text/markdown",
              sizeBytes: 128,
              kind: "document",
            },
          ],
        }),
      );
    });

    expect(container.querySelector('[title="粘贴内容-d6d760e6.md"] .lucide-clipboard-list')).not.toBeNull();
  });

  it("mounts long pasted text as a Markdown attachment instead of flattening it into the draft", async () => {
    const onSendText = vi.fn();
    await act(async () => {
      root.render(
        createElement(AssistantComposer, {
          busy: false,
          mountedContexts: [],
          skills: [],
          quickPrompts: [],
          documents: [],
          connections: [],
          agentProvider: "openai-api",
          agentModel: "auto",
          agentReasoningEffort: "medium",
          assistantSendMode: "enter",
          onDetachMountedContext: vi.fn(),
          onAttachDocument: vi.fn(),
          onAgentSelectionChange: vi.fn(),
          onCancel: vi.fn(),
          onSendText,
          onSteerText: vi.fn(),
        }),
      );
    });

    const textarea = container.querySelector("textarea")!;
    const pastedText = [
      "function summarizeDraft(input) {",
      ...Array.from({ length: 42 }, (_, index) => `  return step${index}(input);`),
      "}",
    ].join("\n");
    const paste = pastedTextEvent(pastedText);
    await act(async () => {
      textarea.dispatchEvent(paste);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(paste.defaultPrevented).toBe(true);
    expect(textarea.value).toBe("");
    expect(container.textContent).toContain("粘贴内容.md");
    const pastedAttachment = container.querySelector<HTMLElement>('[title="粘贴内容.md"]');
    expect(pastedAttachment?.className).toContain("min-h-6.5");
    expect(pastedAttachment?.className).toContain("max-w-39.5");
    expect(pastedAttachment?.className).toContain("rounded-lg");
    expect(pastedAttachment?.querySelector(".lucide-clipboard-list")?.getAttribute("width")).toBe("13");
    expect(pastedAttachment?.querySelector("span")?.className).toContain("text-muted-foreground");
    const removePastedAttachment = pastedAttachment?.querySelector<HTMLButtonElement>('button[title="移除附件"]');
    expect(removePastedAttachment?.className).toContain("pointer-events-none");
    expect(removePastedAttachment?.className).toContain("opacity-0");
    expect(removePastedAttachment?.className).toContain("group-hover:pointer-events-auto");
    expect(invoke).toHaveBeenCalledWith(
      "save_ai_attachment",
      expect.objectContaining({ filename: "粘贴内容.md", mimeType: "text/markdown", bytes: expect.any(Array) }),
    );

    await act(async () => container.querySelector<HTMLButtonElement>('button[title="发送"]')!.click());
    expect(onSendText).toHaveBeenCalledWith(
      "",
      [],
      [expect.objectContaining({ name: "粘贴内容.md", kind: "document", mimeType: "text/markdown" })],
    );
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
          agentProvider: "openai-api",
          agentModel: "auto",
          agentReasoningEffort: "medium",
          onModelChange: vi.fn(),
          onReasoningEffortChange: vi.fn(),
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
    const attachmentButton = composer?.querySelector<HTMLButtonElement>('button[title="添加附件"]');
    const fileInput = composer?.querySelector<HTMLInputElement>('input[type="file"]');
    expect(panel?.className).toContain("[--assistant-panel-gutter:10px]");
    expect(panel?.classList.contains("overflow-hidden")).toBe(true);
    expect(header?.textContent).toContain("新对话");
    expect(header?.className).toContain("px-[var(--assistant-panel-gutter)]");
    expect(viewport?.className).toContain("px-[var(--assistant-panel-gutter)]");
    expect(viewport?.className).not.toContain("-mr-2");
    expect(composer?.className).toContain("mx-[var(--assistant-panel-gutter)]");
    expect(composer?.className).toContain("mb-1");
    expect(composer?.className).toContain("p-2.5");
    expect(inputGroup?.className).toContain("gap-0");
    expect(textarea.getAttribute("rows")).toBe("2");
    expect(textarea.className).toContain("min-h-[2lh]");
    expect(textarea.className).toContain("px-0");
    expect(textarea.className).toContain("py-0");
    expect(textarea.className).toContain("placeholder:text-muted-foreground/65");
    expect(attachmentButton?.querySelector(".lucide-paperclip")).not.toBeNull();
    expect(fileInput?.accept).toContain("application/pdf");
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

  it("mounts long pasted text as a Markdown attachment in the theme assistant", async () => {
    const onSend = vi.fn();
    await act(async () => {
      root.render(
        createElement(WechatThemeAssistantPanel, {
          ...themeConversationProps(),
          messages: [],
          busy: false,
          modelCatalog: null,
          agentProvider: "openai-api",
          agentModel: "auto",
          agentReasoningEffort: "medium",
          onModelChange: vi.fn(),
          onReasoningEffortChange: vi.fn(),
          onSend,
        }),
      );
    });

    const textarea = container.querySelector("textarea")!;
    const pastedText = ["const themePatch = {", ...Array.from({ length: 42 }, (_, index) => `  rule${index}: "value",`), "};"].join("\n");
    const paste = pastedTextEvent(pastedText);
    await act(async () => {
      textarea.dispatchEvent(paste);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(paste.defaultPrevented).toBe(true);
    expect(textarea.value).toBe("");
    expect(container.textContent).toContain("粘贴内容.md");
    const pastedAttachment = container.querySelector<HTMLElement>('[title="粘贴内容.md"]');
    expect(pastedAttachment?.className).toContain("min-h-6.5");
    expect(pastedAttachment?.className).toContain("max-w-39.5");
    expect(pastedAttachment?.className).toContain("rounded-lg");
    expect(pastedAttachment?.querySelector(".lucide-clipboard-list")?.getAttribute("width")).toBe("13");
    const removePastedAttachment = pastedAttachment?.querySelector<HTMLButtonElement>('button[title="移除附件"]');
    expect(removePastedAttachment?.className).toContain("pointer-events-none");
    expect(removePastedAttachment?.className).toContain("opacity-0");
    expect(removePastedAttachment?.className).toContain("group-hover:pointer-events-auto");
    expect(invoke).toHaveBeenCalledWith(
      "save_ai_attachment",
      expect.objectContaining({ filename: "粘贴内容.md", mimeType: "text/markdown", bytes: expect.any(Array) }),
    );

    await act(async () => container.querySelector<HTMLButtonElement>('button[title="发送"]')!.click());
    expect(onSend).toHaveBeenCalledWith("", [
      expect.objectContaining({ name: "粘贴内容.md", kind: "document", mimeType: "text/markdown" }),
    ]);
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
          agentProvider: "openai-api",
          agentModel: "auto",
          agentReasoningEffort: "medium",
          onModelChange: vi.fn(),
          onReasoningEffortChange: vi.fn(),
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
          agentProvider: "openai-api",
          agentModel: "auto",
          agentReasoningEffort: "medium",
          onModelChange: vi.fn(),
          onReasoningEffortChange: vi.fn(),
          onSend: vi.fn(),
          onCancel,
        }),
      );
    });

    const runButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("正在整理思路"));
    expect(runButton).toBeDefined();
    await act(async () => runButton!.click());
    expect(container.textContent).not.toContain("正在检查当前标题层级");

    const reasoningButton = container.querySelector<HTMLButtonElement>('[data-slot="assistant-run-activity"] button');
    expect(reasoningButton?.textContent).toContain("整理思路");
    await act(async () => reasoningButton!.click());
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
          agentProvider: "openai-api",
          agentModel: "auto",
          agentReasoningEffort: "medium",
          onModelChange: vi.fn(),
          onReasoningEffortChange: vi.fn(),
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

function pastedTextEvent(text: string): Event {
  const event = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clipboardData", {
    value: {
      items: [],
      files: [],
      getData: (type: string) => (type === "text/plain" ? text : ""),
    },
  });
  return event;
}
