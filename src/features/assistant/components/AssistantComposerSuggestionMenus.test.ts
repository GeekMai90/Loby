// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React DOM、Vitest、AssistantComposer 与快捷提示/文稿建议契约
 * [OUTPUT]: 验证输入触发建议菜单时复用共享 primitive，并把 combobox 焦点关联到 active option
 * [POS]: assistant components 的建议菜单集成回归测试，保护 `/` 与 `@` 的视觉基础和键盘辅助技术语义
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { act, createElement, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantComposer } from "@/features/assistant/components/AssistantComposer";

describe("AssistantComposer suggestion menus", () => {
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

  it("links the slash-triggered combobox to the shared suggestion menu and active option", async () => {
    await act(async () => {
      root.render(
        createElement(AssistantComposer, {
          ...composerProps(),
          quickPrompts: [
            {
              id: "prompt-1",
              title: "润色当前文章",
              content: "检查并修正错别字。",
              createdAt: "2026-07-25T00:00:00.000Z",
              updatedAt: "2026-07-25T00:00:00.000Z",
            },
          ],
        }),
      );
    });

    const textarea = container.querySelector<HTMLTextAreaElement>("textarea")!;
    await enterComposerText(textarea, "/");

    const menu = container.querySelector<HTMLElement>("[data-slot='suggestion-menu']");
    const activeItem = container.querySelector<HTMLElement>("[data-slot='suggestion-menu-item'][data-active='true']");
    expect(menu?.className).toContain("loby-solid-menu");
    expect(textarea.getAttribute("role")).toBe("combobox");
    expect(textarea.getAttribute("aria-expanded")).toBe("true");
    expect(textarea.getAttribute("aria-controls")).toBe(menu?.id);
    expect(textarea.getAttribute("aria-activedescendant")).toBe(activeItem?.id);
  });
});

function composerProps(): ComponentProps<typeof AssistantComposer> {
  return {
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
    onSendText: vi.fn(),
    onSteerText: vi.fn(),
  };
}

async function enterComposerText(textarea: HTMLTextAreaElement, value: string) {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    setter?.call(textarea, value);
    textarea.setSelectionRange(value.length, value.length);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.dispatchEvent(new Event("select", { bubbles: true }));
  });
}
