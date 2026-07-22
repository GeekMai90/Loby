import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { lobyMarkdownExtensions } from "@/features/editor/model/editorMarkdownLanguage";
import { normalizeExternalLink, resolveMarkdownLinkAt } from "@/features/editor/model/editorLinkNavigation";

function createState(doc: string) {
  return EditorState.create({
    doc,
    extensions: [markdown({ extensions: lobyMarkdownExtensions })],
  });
}

describe("editorLinkNavigation", () => {
  it("resolves an inline Markdown link from its visible label", () => {
    const doc = "查看 [支持页面](https://bear.app/faq/markdown-syntax/) 了解更多";
    const target = resolveMarkdownLinkAt(createState(doc), doc.indexOf("支持") + 1);

    expect(target?.url).toBe("https://bear.app/faq/markdown-syntax/");
    expect(doc.slice(target?.labelFrom, target?.labelTo)).toBe("支持页面");
  });

  it("resolves links whose labels contain nested Markdown styles", () => {
    const doc = "[**链接**](bear.app/)";
    const target = resolveMarkdownLinkAt(createState(doc), doc.indexOf("链接") + 1);

    expect(target?.url).toBe("bear.app/");
    expect(doc.slice(target?.labelFrom, target?.labelTo)).toBe("**链接**");
  });

  it("does not treat the destination source or footnotes as clickable labels", () => {
    const link = "[链接](https://example.com)";
    expect(resolveMarkdownLinkAt(createState(link), link.indexOf("example"))).toBeNull();

    const footnote = "正文[^1]";
    expect(resolveMarkdownLinkAt(createState(footnote), footnote.indexOf("1"))).toBeNull();
  });

  it("supports autolinks", () => {
    const doc = "访问 <https://example.com/docs>";
    expect(resolveMarkdownLinkAt(createState(doc), doc.indexOf("example"))?.url).toBe("https://example.com/docs");
  });

  it("normalizes web domains and rejects unsafe or relative destinations", () => {
    expect(normalizeExternalLink("bear.app/faq/")).toBe("https://bear.app/faq/");
    expect(normalizeExternalLink("<https://example.com/a b>")).toBe("https://example.com/a%20b");
    expect(normalizeExternalLink("mailto:hello@example.com")).toBe("mailto:hello@example.com");
    expect(normalizeExternalLink("javascript:alert(1)")).toBeNull();
    expect(normalizeExternalLink("../另一篇文稿.md")).toBeNull();
  });
});
