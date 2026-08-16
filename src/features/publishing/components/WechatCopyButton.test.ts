// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React DOM、Vitest、WechatCopyButton 与公众号文本/富文本剪贴板适配
 * [OUTPUT]: 验证预览按钮外观、普通主题复制路径，以及公众号预览组合原生摘要/标题前序与 DOM 选区富文本复制
 * [POS]: publishing 的复制按钮回归边界，保护主题工作室单次复制与预览模态窗剪贴板历史语义
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

const nativeClipboard = vi.hoisted(() => ({
  available: vi.fn(() => false),
  writePrelude: vi.fn(async () => undefined),
}));

vi.mock("@/features/publishing/model/api", () => ({
  isDesktopPublishingAvailable: nativeClipboard.available,
  writeWechatClipboardPrelude: nativeClipboard.writePrelude,
}));

import { WechatCopyButton } from "@/features/publishing/components/WechatCopyButton";

describe("WechatCopyButton", () => {
  it("uses the shared icon button appearance in the preview", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        createElement(WechatCopyButton, {
          html: '<section style="color:#111">正文</section>',
          iconOnly: true,
        }),
      );
    });

    const button = container.querySelector("button");
    expect(button?.getAttribute("data-slot")).toBe("button");
    expect(button?.className).not.toContain("liquid-glass-button");
    expect(button?.getAttribute("aria-label")).toBe("复制排版");
    expect(button?.textContent).toBe("");

    await act(async () => root.unmount());
    container.remove();
  });

  it("copies the final rich layout and confirms the result", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    const write = vi.fn(async () => undefined);
    class TestClipboardItem {
      constructor(readonly items: Record<string, Blob>) {}
    }
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { write } });
    vi.stubGlobal("ClipboardItem", TestClipboardItem);
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);

    try {
      await act(async () => {
        root.render(createElement(WechatCopyButton, { html: '<section style="color:#111">正文</section>' }));
      });

      expect(container.textContent).toContain("复制排版");
      expect(container.querySelector("button")?.getAttribute("title")).toContain("粘贴到公众号编辑器");
      await act(async () => container.querySelector<HTMLButtonElement>("button")!.click());
      expect(write).toHaveBeenCalledOnce();
      expect(container.textContent).toContain("已复制");
    } finally {
      act(() => root.unmount());
      container.remove();
      if (originalClipboard) Object.defineProperty(navigator, "clipboard", originalClipboard);
      else Reflect.deleteProperty(navigator, "clipboard");
      vi.unstubAllGlobals();
    }
  });

  it("stages article metadata natively before copying the rich layout from a DOM selection", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const execCommand = vi.fn(() => true);
    Object.defineProperty(document, "execCommand", { configurable: true, value: execCommand });
    nativeClipboard.available.mockReturnValue(true);
    nativeClipboard.writePrelude.mockClear();
    vi.spyOn(navigator, "platform", "get").mockReturnValue("MacIntel");
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);

    try {
      await act(async () => {
        root.render(
          createElement(WechatCopyButton, {
            html: '<section style="color:#111">正文</section>',
            article: { description: "文章摘要", title: "文章标题" },
          }),
        );
      });

      expect(container.querySelector("button")?.getAttribute("title")).toContain("剪贴板历史");
      await act(async () => container.querySelector<HTMLButtonElement>("button")!.click());

      expect(nativeClipboard.writePrelude).toHaveBeenCalledWith({ description: "文章摘要", title: "文章标题" });
      expect(execCommand).toHaveBeenCalledWith("copy");
      expect(container.textContent).toContain("已复制");
    } finally {
      act(() => root.unmount());
      container.remove();
      nativeClipboard.available.mockReturnValue(false);
      Reflect.deleteProperty(document, "execCommand");
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    }
  });
});
