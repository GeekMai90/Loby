import { describe, expect, it } from "vitest";
import { renderMarkdownHtml } from "./export";

describe("Markdown highlight export", () => {
  it("renders == syntax as highlight and leaves legacy double-colon text unchanged", async () => {
    const html = await renderMarkdownHtml("这是 ==重点==，::普通冒号内容::。\n\n`==代码==`");

    expect(html).toContain('<mark class="nibva-highlight">重点</mark>');
    expect(html).toContain("::普通冒号内容::");
    expect(html).toContain("<code>==代码==</code>");
  });

  it("preserves nested underline, highlight, and emphasis", async () => {
    const html = await renderMarkdownHtml("~==_样式_==~");

    expect(html).toContain('<u class="nibva-underline"><mark class="nibva-highlight"><em>样式</em></mark></u>');
  });

  it("keeps Bear underline distinct from GFM strikethrough", async () => {
    const html = await renderMarkdownHtml("~下划线~ 和 ~~删除线~~");

    expect(html).toContain('<u class="nibva-underline">下划线</u>');
    expect(html).toContain("<del>删除线</del>");
  });

  it("keeps adjacent bold and Bear underline boundaries intact", async () => {
    const html = await renderMarkdownHtml("例如在同一段**~文本~**上添加**粗体**和~下划线~。");

    expect(html).toContain(
      '例如在同一段<strong><u class="nibva-underline">文本</u></strong>上添加<strong>粗体</strong>和<u class="nibva-underline">下划线</u>。',
    );
  });

  it("renders unresolved footnote references as superscript numbers", async () => {
    const html = await renderMarkdownHtml("Markdown[^1]");

    expect(html).toContain('Markdown<sup class="nibva-footnote-reference">1</sup>');
    expect(html).not.toContain("^1");
  });
});
