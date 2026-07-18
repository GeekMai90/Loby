// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";
import { copyTextToClipboard, downloadText, openPrintPreview } from "./exportBrowser";

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe("export browser effects", () => {
  it("downloads through a temporary object URL and releases it", () => {
    const createObjectUrl = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:loby-export");
    const revokeObjectUrl = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    downloadText("draft.md", "正文");

    expect(createObjectUrl).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:loby-export");
  });

  it("uses the native clipboard API when it is available", async () => {
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);

    await copyTextToClipboard("待复制内容");

    expect(writeText).toHaveBeenCalledWith("待复制内容");
  });

  it("reports a blocked print window without writing a document", () => {
    vi.spyOn(window, "open").mockReturnValue(null);

    expect(openPrintPreview("标题", "<p>正文</p>")).toBe(false);
  });

  it("writes only the exported body and escapes the print title", () => {
    const write = vi.fn();
    const printDocument = { open: vi.fn(), write, close: vi.fn() };
    vi.spyOn(window, "open").mockReturnValue({ document: printDocument } as unknown as Window);

    expect(openPrintPreview("<项目&标题>", "<!doctype html><html><body><p>正文</p></body></html>")).toBe(true);

    expect(write).toHaveBeenCalledOnce();
    const printHtml = String(write.mock.calls[0]?.[0]);
    expect(printHtml).toContain("<title>&lt;项目&amp;标题&gt;</title>");
    expect(printHtml).toContain("<main><p>正文</p></main>");
    expect(printHtml).not.toContain("<!doctype html><html><body>");
    expect(printDocument.close).toHaveBeenCalledOnce();
  });
});
