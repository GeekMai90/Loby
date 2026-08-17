/**
 * [INPUT]: 依赖 Vitest、Markdown 排版规则与格式化设置默认值
 * [OUTPUT]: 验证 Markdown 排版五类规则、行内强调的 Unicode 空白边界、硬换行/转义边界、受保护片段、块间距与设置归一化
 * [POS]: editor/model 的 Markdown 排版回归测试，保护正文语义不被格式化器误改
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
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

  it("protects frontmatter, code, inline code, links, Obsidian references, image paths, versions, dates, and filenames", () => {
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
      "保留 ![[assets/中文,image.png|中文Markdown封面]] 和 [[中文Markdown,索引]]。",
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
        "保留 ![[assets/中文,image.png|中文Markdown封面]] 和 [[中文Markdown,索引]]。",
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

  it("restores blank lines between ordinary paragraph lines", () => {
    const source = "第一段的第一行\n第二段的第一行\n\n\n## 小标题\n正文\n第三段的第一行\n第四段的第一行\n- 列表\n- 列表二";
    expect(formatMarkdownDocument(source, DEFAULT_MARKDOWN_FORMATTING_SETTINGS)).toBe(
      "第一段的第一行\n\n第二段的第一行\n\n## 小标题\n\n正文\n\n第三段的第一行\n\n第四段的第一行\n\n- 列表\n- 列表二\n",
    );
  });

  it("preserves explicit hard breaks inside a paragraph", () => {
    const source = "第一行  \n第一段第二行\n第二段第一行\\\n第二段第二行\n第三段第一行<br>\n第三段第二行";
    expect(
      formatMarkdownDocument(source, {
        formatOnSave: false,
        cleanupWhitespace: false,
        normalizeBlockSpacing: true,
        normalizeMarkdownMarkers: false,
        spaceCjkAndLatin: false,
        fullWidthPunctuation: false,
      }),
    ).toBe("第一行  \n第一段第二行\n\n第二段第一行\\\n第二段第二行\n\n第三段第一行<br>\n第三段第二行\n");
  });

  it("keeps non-paragraph Markdown blocks intact", () => {
    const source = "普通段落第一行\n普通段落第二行\n\n> 引用第一行\n> 引用第二行\n\n- 列表一\n- 列表二\n\n```ts\nconst value = 1;\n```";
    expect(
      formatMarkdownDocument(source, {
        formatOnSave: false,
        cleanupWhitespace: false,
        normalizeBlockSpacing: true,
        normalizeMarkdownMarkers: false,
        spaceCjkAndLatin: false,
        fullWidthPunctuation: false,
      }),
    ).toBe("普通段落第一行\n\n普通段落第二行\n\n> 引用第一行\n> 引用第二行\n\n- 列表一\n- 列表二\n\n```ts\nconst value = 1;\n```\n");
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

  it("is idempotent for every combination of the five formatting groups", () => {
    const source = [
      "---",
      'title: "中文,Markdown"',
      "---",
      "",
      "#标题  ",
      "",
      "前一段。**第一处。**，然后：** 第二处。 **后面 中文Markdown,很好!  ",
      "下一行",
      "",
      "+项目",
      "-1",
      ">引用",
      "",
      "保留 `** 代码。 **后面`、![[assets/中文,image.png|中文Markdown封面]]。",
    ].join("\n");
    const keys = [
      "cleanupWhitespace",
      "normalizeBlockSpacing",
      "normalizeMarkdownMarkers",
      "spaceCjkAndLatin",
      "fullWidthPunctuation",
    ] as const;

    for (let mask = 0; mask < 1 << keys.length; mask += 1) {
      const settings = { ...DEFAULT_MARKDOWN_FORMATTING_SETTINGS, formatOnSave: false };
      keys.forEach((key, index) => {
        settings[key] = Boolean(mask & (1 << index));
      });
      const once = formatMarkdownDocument(source, settings);
      expect(formatMarkdownDocument(once, settings), JSON.stringify(settings)).toBe(once);
    }
  });

  it("adds a portable space after Chinese-punctuation-terminated strong emphasis", () => {
    const source = "真正的自律。**自然的生命状态。**一个真正自律的人";

    expect(formatMarkdownDocument(source, DEFAULT_MARKDOWN_FORMATTING_SETTINGS)).toBe(
      "真正的自律。**自然的生命状态。** 一个真正自律的人\n",
    );
  });

  it("keeps the opening strong marker adjacent to its content", () => {
    const source =
      "老子是在提醒我们：**当一个品质需要被反复展示时，它很可能已经从自然的生命状态，变成了公开展示的自我形象。**一个真正自律的人，未必天天说“我很自律”；一个真正有修养的人，通常也很少提醒别人“我是一个很有修养的人”；一个真正聪明的人，也很少急着证明自己很聪明。";

    expect(formatMarkdownDocument(source, DEFAULT_MARKDOWN_FORMATTING_SETTINGS)).toBe(
      "老子是在提醒我们：**当一个品质需要被反复展示时，它很可能已经从自然的生命状态，变成了公开展示的自我形象。** 一个真正自律的人，未必天天说“我很自律”；一个真正有修养的人，通常也很少提醒别人“我是一个很有修养的人”；一个真正聪明的人，也很少急着证明自己很聪明。\n",
    );
  });

  it("removes an existing space after the opening strong marker", () => {
    const source = "老子提醒我们：** 当一个品质需要被反复展示时，它很可能已经变成了公开展示的自我形象。** 一个真正自律的人。";

    expect(formatMarkdownDocument(source, DEFAULT_MARKDOWN_FORMATTING_SETTINGS)).toBe(
      "老子提醒我们：**当一个品质需要被反复展示时，它很可能已经变成了公开展示的自我形象。** 一个真正自律的人。\n",
    );
  });

  it("removes spaces around both sides of a Chinese strong emphasis span", () => {
    const source = "老子提醒我们：** 当一个品质已经变成了公开展示的自我形象。 ** 一个真正自律的人。";

    expect(formatMarkdownDocument(source, DEFAULT_MARKDOWN_FORMATTING_SETTINGS)).toBe(
      "老子提醒我们：**当一个品质已经变成了公开展示的自我形象。** 一个真正自律的人。\n",
    );
  });

  it("repairs malformed strong markers after a preceding strong paragraph", () => {
    const source = [
      "前一段。**人很难长时间坚持做自己既不擅长、也不喜欢做的事，那样就是活得拧巴。**",
      "",
      "老子是在提醒我们：** 当一个品质需要被反复展示时，它很可能已经从自然的生命状态，变成了公开展示的自我形象。** 一个真正自律的人。",
    ].join("\n");

    expect(formatMarkdownDocument(source, DEFAULT_MARKDOWN_FORMATTING_SETTINGS)).toBe(
      [
        "前一段。**人很难长时间坚持做自己既不擅长、也不喜欢做的事，那样就是活得拧巴。**",
        "",
        "老子是在提醒我们：**当一个品质需要被反复展示时，它很可能已经从自然的生命状态，变成了公开展示的自我形象。** 一个真正自律的人。",
        "",
      ].join("\n"),
    );
  });

  it.each([
    ["non-breaking space", "\u00a0"],
    ["full-width space", "\u3000"],
    ["narrow no-break space", "\u202f"],
    ["zero-width space", "\u200b"],
  ])("removes %s artifacts inside Chinese strong markers", (_label, spacing) => {
    const source = `老子是在提醒我们： **${spacing}当一个品质已经变成了公开展示的自我形象。${spacing}** 一个真正自律的人。`;

    expect(formatMarkdownDocument(source, DEFAULT_MARKDOWN_FORMATTING_SETTINGS)).toBe(
      "老子是在提醒我们： **当一个品质已经变成了公开展示的自我形象。** 一个真正自律的人。\n",
    );
  });

  it("does not reinterpret line-leading emphasis as a list marker", () => {
    const source = "**重点。**后面\n** 需修复。 **后面\n*斜体*后面\n**" + "\n+项目";

    expect(
      formatMarkdownDocument(source, {
        formatOnSave: false,
        cleanupWhitespace: false,
        normalizeBlockSpacing: false,
        normalizeMarkdownMarkers: true,
        spaceCjkAndLatin: false,
        fullWidthPunctuation: false,
      }),
    ).toBe("**重点。** 后面\n**需修复。** 后面\n*斜体*后面\n**\n- 项目");
  });

  it("does not reinterpret signed numbers as unordered lists", () => {
    const source = "-1\n+2\n-2026-08-17\n+项目";

    expect(
      formatMarkdownDocument(source, {
        formatOnSave: false,
        cleanupWhitespace: false,
        normalizeBlockSpacing: false,
        normalizeMarkdownMarkers: true,
        spaceCjkAndLatin: false,
        fullWidthPunctuation: false,
      }),
    ).toBe("-1\n+2\n-2026-08-17\n- 项目");
  });

  it.each([
    ["multiple spans on one line", "**第一。**，然后：**第二。**后面", "**第一。**，然后：**第二。** 后面"],
    ["an earlier unclosed marker", "未闭合 **前文，然后：**第二。**后面", "未闭合 **前文，然后：**第二。** 后面"],
  ])("keeps %s isolated in the complete formatting pipeline", (_label, source, expected) => {
    const once = formatMarkdownDocument(source, DEFAULT_MARKDOWN_FORMATTING_SETTINGS);

    expect(once).toBe(`${expected}\n`);
    expect(formatMarkdownDocument(once, DEFAULT_MARKDOWN_FORMATTING_SETTINGS)).toBe(once);
  });

  it("preserves hard breaks while normalizing quote markers", () => {
    const source = "> 第一行  \n> 第二行";

    expect(
      formatMarkdownDocument(source, {
        formatOnSave: false,
        cleanupWhitespace: false,
        normalizeBlockSpacing: false,
        normalizeMarkdownMarkers: true,
        spaceCjkAndLatin: false,
        fullWidthPunctuation: false,
      }),
    ).toBe(source);
  });

  it("normalizes strong emphasis across protected inline code and links", () => {
    const source = "前文 **这是 `代码`。**后面\n前文 **这是 [链接](https://example.com)。**后面";

    expect(formatMarkdownDocument(source, DEFAULT_MARKDOWN_FORMATTING_SETTINGS)).toBe(
      "前文 **这是 `代码`。** 后面\n\n前文 **这是 [链接](https://example.com)。** 后面\n",
    );
  });

  it("leaves escaped Chinese punctuation unchanged", () => {
    const source = "中文\\,英文 中文\\!英文 中文\\(括号\\)";

    expect(
      formatMarkdownDocument(source, {
        formatOnSave: false,
        cleanupWhitespace: false,
        normalizeBlockSpacing: false,
        normalizeMarkdownMarkers: false,
        spaceCjkAndLatin: false,
        fullWidthPunctuation: true,
      }),
    ).toBe(source);
  });

  it("preserves CRLF when only Markdown markers are normalized", () => {
    const source = "#标题\r\n正文";

    expect(
      formatMarkdownDocument(source, {
        formatOnSave: false,
        cleanupWhitespace: false,
        normalizeBlockSpacing: false,
        normalizeMarkdownMarkers: true,
        spaceCjkAndLatin: false,
        fullWidthPunctuation: false,
      }),
    ).toBe("# 标题\r\n正文");
  });

  it("does not change escaped or code-contained strong markers", () => {
    const source = "\\*\\*不是粗体。**后面 `**代码。**后面` 与 **是真粗体。**后面";

    expect(formatMarkdownDocument(source, DEFAULT_MARKDOWN_FORMATTING_SETTINGS)).toBe(
      "\\*\\*不是粗体。**后面 `**代码。**后面` 与 **是真粗体。** 后面\n",
    );
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
