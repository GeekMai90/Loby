// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { WechatCopyButton } from "./WechatCopyButton";

describe("WechatCopyButton", () => {
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
});
