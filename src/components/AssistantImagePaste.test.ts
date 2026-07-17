// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantComposer } from "./AssistantComposer";
import { WechatThemeAssistantPanel } from "./WechatThemeAssistantPanel";

const { invoke } = vi.hoisted(() => ({
  invoke: vi.fn(async (_command: string, args: Record<string, unknown>) => ({
    id: `/tmp/nibva-ai/${String(args.filename)}`,
    name: String(args.filename),
    path: `/tmp/nibva-ai/${String(args.filename)}`,
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
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:nibva-preview");
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
        }),
      );
    });

    const textarea = container.querySelector("textarea")!;
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
});

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
