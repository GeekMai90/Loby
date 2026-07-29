import { describe, expect, it } from "vitest";
import { formatMarkdownDocument } from "@/features/editor/model/markdownFormatting";
import {
  DEFAULT_MARKDOWN_FORMATTING_SETTINGS,
  normalizeMarkdownFormattingSettings,
} from "@/features/editor/model/markdownFormattingSettings";

describe("formatMarkdownDocument", () => {
  it("applies the five recommended formatting groups", () => {
    const source = ["#标题  ", "", "", "中文Markdown写作,很好!  ", "", "+项目一", "+  项目二", "", ">引用内容"].join("\n");

    expect(formatMarkdownDocument(source, DEFAULT_MARKDOWN_FORMATTING_SETTINGS)).toBe(
      ["# 标题", "", "中文 Markdown 写作，很好！", "", "- 项目一", "- 项目二", "", "> 引用内容", ""].join("\n"),
    );
  });

  it("protects frontmatter, code, inline code, links, image paths, versions, dates, and filenames", () => {
    const source = [
      "---",
      'title: "中文,Markdown"',
      "---",
      "",
      "#标题",
      "",
      "中文Markdown,正文! `中文,code!` [中文Markdown](https://example.com/a,b?q=中文)",
      "",
      "![中文,图片](../assets/中文,image.png)",
      "",
      "```ts",
      'const  message = "中文,code!";  ',
      "```",
      "",
      "保留 Loby 2.1.0、2026-07-19 和 文档.md。",
    ].join("\n");

    expect(formatMarkdownDocument(source, DEFAULT_MARKDOWN_FORMATTING_SETTINGS)).toBe(
      [
        "---",
        'title: "中文,Markdown"',
        "---",
        "",
        "# 标题",
        "",
        "中文 Markdown，正文！ `中文,code!` [中文 Markdown](https://example.com/a,b?q=中文)",
        "",
        "![中文，图片](../assets/中文,image.png)",
        "",
        "```ts",
        'const  message = "中文,code!";  ',
        "```",
        "",
        "保留 Loby 2.1.0、2026-07-19 和 文档.md。",
        "",
      ].join("\n"),
    );
  });

  it("preserves paragraph-internal line breaks while normalizing top-level block spacing", () => {
    const source = "第一段的第一行\n第一段的第二行\n\n\n## 小标题\n正文\n- 列表\n- 列表二";
    expect(formatMarkdownDocument(source, DEFAULT_MARKDOWN_FORMATTING_SETTINGS)).toBe(
      "第一段的第一行\n第一段的第二行\n\n## 小标题\n\n正文\n\n- 列表\n- 列表二\n",
    );
  });

  it("keeps disabled formatting groups unchanged", () => {
    const source = "\n#标题\n\n\n中文Markdown,正文!\n\n";
    expect(
      formatMarkdownDocument(source, {
        formatOnSave: false,
        cleanupWhitespace: false,
        normalizeBlockSpacing: false,
        normalizeMarkdownMarkers: false,
        spaceCjkAndLatin: false,
        fullWidthPunctuation: false,
      }),
    ).toBe(source);
  });

  it("preserves outer whitespace when only Chinese typography is enabled", () => {
    const source = '---\ntitle: "测试,Title"\n---\n\n\n中文Markdown,正文!\n\n';
    expect(
      formatMarkdownDocument(source, {
        formatOnSave: false,
        cleanupWhitespace: false,
        normalizeBlockSpacing: false,
        normalizeMarkdownMarkers: false,
        spaceCjkAndLatin: true,
        fullWidthPunctuation: true,
      }),
    ).toBe('---\ntitle: "测试,Title"\n---\n\n\n中文 Markdown，正文！\n\n');
  });

  it("is idempotent", () => {
    const source = "#标题\n\n\n中文Markdown,正文!\n+条目";
    const once = formatMarkdownDocument(source, DEFAULT_MARKDOWN_FORMATTING_SETTINGS);
    expect(formatMarkdownDocument(once, DEFAULT_MARKDOWN_FORMATTING_SETTINGS)).toBe(once);
  });
});

describe("normalizeMarkdownFormattingSettings", () => {
  it("uses defaults for missing or invalid values and preserves explicit choices", () => {
    expect(normalizeMarkdownFormattingSettings(null)).toEqual(DEFAULT_MARKDOWN_FORMATTING_SETTINGS);
    expect(normalizeMarkdownFormattingSettings({ cleanupWhitespace: false, normalizeBlockSpacing: "yes" })).toEqual({
      ...DEFAULT_MARKDOWN_FORMATTING_SETTINGS,
      cleanupWhitespace: false,
    });
  });
});
