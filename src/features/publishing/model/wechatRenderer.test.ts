/**
 * [INPUT]: 依赖 Vitest、happy-dom、公众号主题 registry 与公众号渲染/剪贴板适配器
 * [OUTPUT]: 验证公众号主题 HTML、列表兼容性、主题变换安全边界、原生摘要/标题前序与 DOM 选区富文本复制，以及草稿 API 空白实体化
 * [POS]: publishing model 的公众号渲染回归边界，分别保护预览、草稿 API 与复制渠道的最终 HTML 契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cloneWechatThemeManifest, getWechatThemeValidationIssues } from "@/features/publishing/model/wechatThemeModel";

const nativeClipboard = vi.hoisted(() => ({
  available: vi.fn(() => false),
  writePrelude: vi.fn(async () => undefined),
}));

vi.mock("@/features/publishing/model/api", () => ({
  isDesktopPublishingAvailable: nativeClipboard.available,
  writeWechatClipboardPrelude: nativeClipboard.writePrelude,
}));

import {
  copyWechatArticleToClipboard,
  copyWechatHtml,
  prepareWechatClipboardHtml,
  prepareWechatDraftHtml,
  renderWechatArticle,
} from "@/features/publishing/model/wechatRenderer";
import { getWechatTheme } from "@/features/publishing/model/wechatThemes";

const ARTICLE = `# 用 AI 打磨公众号主题

这是一段包含 **重点**、*斜体*、[链接](https://example.com) 和 \`代码\` 的正文。

## 第一部分

> 引用内容

### 小标题

#### 四级标题

- 列表一
- 列表二

| 项目 | 内容 |
| --- | --- |
| 主题 | 深蓝 |

---

![示例图片](https://example.com/image.png)

\`\`\`ts
const theme = "loby";
\`\`\`
`;

describe("wechat renderer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    nativeClipboard.available.mockReset();
    nativeClipboard.available.mockReturnValue(false);
    nativeClipboard.writePrelude.mockReset();
    nativeClipboard.writePrelude.mockResolvedValue(undefined);
  });

  it("compiles the Loby basic theme to restrained inline WeChat HTML", async () => {
    const result = await renderWechatArticle({
      title: "备用标题",
      markdown: ARTICLE,
      date: "2026-07-16",
      tags: ["AI", "写作"],
      themeId: "loby-basic",
    });

    expect(result.title).toBe("用 AI 打磨公众号主题");
    expect(result.compatibilityWarnings).toEqual([]);
    expect(result.html).toContain('data-theme="loby-basic"');
    expect(result.html).toContain("font-size: 17px");
    expect(result.html).toContain("border-left-color: #D7D7DD");
    expect(result.html).not.toContain("article-summary");
    expect(result.html).not.toContain("一篇来自 Loby 的文章");
    expect(result.html).not.toContain("麦先生说");
    expect(result.html).not.toContain("<style");
    expect(result.readingMinutes).toBeGreaterThanOrEqual(1);
  });

  it("compiles every bundled open-source template without external CSS", async () => {
    for (const themeId of ["classic", "grace", "simple"]) {
      const result = await renderWechatArticle({ title: "备用标题", markdown: ARTICLE, themeId });
      expect(result.compatibilityWarnings, themeId).toEqual([]);
      expect(result.html).toContain(`data-theme="${themeId}"`);
      expect(result.html).not.toContain("<style");
      expect(result.html).not.toContain("麦先生说");
    }
  });

  it("hides the article-level title in the four system themes", async () => {
    for (const themeId of ["loby-basic", "classic", "grace", "simple"]) {
      const result = await renderWechatArticle({ title: "备用标题", markdown: ARTICLE, themeId });
      const container = document.createElement("div");
      container.innerHTML = result.html;
      const header = container.querySelector('[data-loby-role="article-header"]');
      const title = container.querySelector('[data-loby-role="article-title"]');

      expect(header, themeId).not.toBeNull();
      expect(title, themeId).not.toBeNull();
      expect(title?.getAttribute("style"), themeId).toMatch(/display:\s*none/);
      expect(result.html).toContain('data-loby-role="article-body"');

      const clipboardHtml = prepareWechatClipboardHtml(result.html);
      expect(clipboardHtml, themeId).not.toContain('data-loby-role="article-title"');
      expect(clipboardHtml, themeId).toContain('data-loby-role="article-body"');
    }
  });

  it("allows a personal theme to restore the title with explicit CSS", async () => {
    const theme = cloneWechatThemeManifest(getWechatTheme("loby-basic"));
    theme.id = "title-enabled-theme";
    theme.kind = "personal";
    theme.custom = {
      css: `${theme.custom?.css ?? ""}\n[data-loby-role="article-title"] { display:block; color:#123456; }`,
      htmlTransforms: [],
    };

    const result = await renderWechatArticle({ title: "备用标题", markdown: ARTICLE, themeId: theme.id, theme });
    const container = document.createElement("div");
    container.innerHTML = result.html;
    const title = container.querySelector('[data-loby-role="article-title"]');

    expect(title?.getAttribute("style"), "title-enabled-theme").toMatch(/display:\s*block/);
    expect(title?.getAttribute("style"), "title-enabled-theme").toMatch(/color:\s*#123456/);
  });

  it("converts task-list checkboxes to static WeChat-compatible markers", async () => {
    const result = await renderWechatArticle({
      title: "任务列表",
      markdown: "# 任务列表\n\n- [x] 已完成\n- [ ] 待完成",
      themeId: "loby-basic",
    });

    expect(result.html).toContain("☑ 已完成");
    expect(result.html).toContain("☐ 待完成");
    expect(result.html).not.toContain("<input");
    expect(result.compatibilityWarnings).toEqual([]);
  });

  it("flattens loose unordered and ordered list items for WeChat compatibility", async () => {
    const result = await renderWechatArticle({
      title: "列表兼容",
      markdown: "# 列表兼容\n\n- 无序第一项\n\n- 无序第二项\n\n1. 有序第一项\n\n2. 有序第二项",
      themeId: "loby-basic",
    });
    const renderedDocument = new DOMParser().parseFromString(result.html, "text/html");
    const renderedItems = renderedDocument.querySelectorAll<HTMLElement>("ul > li, ol > li");

    expect(renderedItems).toHaveLength(4);
    expect(Array.from(renderedItems).map((item) => item.textContent?.trim())).toEqual([
      "无序第一项",
      "无序第二项",
      "有序第一项",
      "有序第二项",
    ]);

    const clipboardHtml = await prepareWechatClipboardHtml(result.html);
    const clipboardDocument = new DOMParser().parseFromString(clipboardHtml, "text/html");
    expect(clipboardDocument.querySelectorAll("ul > li > p, ol > li > p")).toHaveLength(0);
    expect(clipboardDocument.querySelectorAll("ul > li, ol > li")).toHaveLength(4);
    expect(clipboardDocument.body.textContent).toContain("无序第一项");
    expect(clipboardDocument.body.textContent).toContain("有序第一项");
  });

  it("stabilizes list whitespace and alignment only for the WeChat draft API", () => {
    const source = '<section><ol style="color:#123456">\n<li><strong>第一项</strong></li>\n<li>第二项</li>\n</ol></section>';
    const draftHtml = prepareWechatDraftHtml(source);
    const draftDocument = new DOMParser().parseFromString(draftHtml, "text/html");
    const list = draftDocument.querySelector("ol");

    expect(Array.from(list?.childNodes ?? []).every((node) => node.nodeType === 1)).toBe(true);
    expect(list?.querySelectorAll(":scope > li")).toHaveLength(2);
    expect((list as HTMLElement | null)?.style.color).toBe("#123456");
    expect(list?.querySelector("strong")?.textContent).toBe("第一项");
    for (const item of list?.querySelectorAll<HTMLElement>(":scope > li") ?? []) {
      expect(item.style.textAlign).toBe("left");
      expect(item.style.getPropertyValue("text-align-last")).toBe("left");
      expect(item.getAttribute("style")).toContain("word-spacing: normal");
    }
    expect(prepareWechatClipboardHtml(source)).toContain("\n<li>");
    expect(prepareWechatClipboardHtml(source)).not.toContain("word-spacing");
  });

  it("materializes code block line breaks and indentation for the WeChat draft API", () => {
    const placeholder = "https://loby.invalid/wechat-image-0";
    const draftHtml = prepareWechatDraftHtml(
      `<section><pre style="white-space:pre-wrap"><code class="language-text">my-blog/\n    ├── content/\n\t└── README.md\n</code></pre><img src="${placeholder}"></section>`,
    );
    const draftDocument = new DOMParser().parseFromString(draftHtml, "text/html");
    const code = draftDocument.querySelector("pre code");

    expect(code?.querySelectorAll("br")).toHaveLength(2);
    expect(code?.textContent).toContain("\u00a0\u00a0\u00a0\u00a0├── content/");
    expect(code?.textContent).toContain("\u00a0\u00a0\u00a0\u00a0└── README.md");
    expect(draftDocument.querySelector("img")?.getAttribute("src")).toBe(placeholder);
  });

  it("applies free AI-authored CSS and HTML, then removes executable markup", async () => {
    const theme = cloneWechatThemeManifest(getWechatTheme("loby-basic"));
    theme.id = "my-open-theme";
    theme.kind = "personal";
    theme.name = "自由主题";
    theme.baseThemeId = "loby-basic";
    theme.baseStyle.colors.accent = "#24513B";
    theme.custom = {
      css: '[data-loby-role="article-body"] h2{background:#F0F8F3;border-left:4px solid var(--loby-accent)} h3::before{content:"✦";color:var(--loby-accent);margin-right:6px}',
      htmlTransforms: [
        {
          selector: '[data-loby-role="article-body"] h2',
          operation: "replace-inner",
          html: '<span class="free-title">{{content}}</span><script>alert(1)</script>',
        },
      ],
    };

    expect(getWechatThemeValidationIssues(theme)).toEqual([]);
    const result = await renderWechatArticle({ title: "备用标题", markdown: ARTICLE, themeId: theme.id, theme });

    expect(result.html).toContain("free-title");
    expect(result.html).toContain("background: #F0F8F3");
    expect(result.html).toContain("border-left-color: #24513B");
    expect(result.html).toContain("✦");
    expect(result.html).not.toContain("<script");
    expect(result.compatibilityWarnings).toEqual(expect.arrayContaining([expect.stringContaining("已移除 1 个")]));
  });

  it("honors selector specificity and resolves AI-authored custom properties", async () => {
    const theme = cloneWechatThemeManifest(getWechatTheme("loby-basic"));
    theme.id = "cascade-theme";
    theme.kind = "personal";
    theme.custom = {
      css: `
        [data-loby-publish="wechat"] { --custom-tone:#24513B; }
        [data-loby-role="article-body"] h2 { --custom-gap:12px; color:#123456; margin-left:var(--custom-gap); }
        h2 { color:#ABCDEF; }
        h3::before { content:"✦"; color:var(--custom-tone); margin-right:6px; }
      `,
      htmlTransforms: [],
    };

    const result = await renderWechatArticle({ title: "备用标题", markdown: ARTICLE, themeId: theme.id, theme });

    const documentNode = new DOMParser().parseFromString(result.html, "text/html");
    const h2 = documentNode.querySelector<HTMLElement>("h2");
    const h3Decoration = documentNode.querySelector<HTMLElement>("h3 > span[aria-hidden='true']");
    expect(h2?.style.color).toBe("#123456");
    expect(h2?.style.marginLeft).toBe("12px");
    expect(h2?.style.cssText).not.toContain("--custom-gap");
    expect(h3Decoration?.textContent).toBe("✦");
    expect(h3Decoration?.style.color).toBe("#24513B");
    expect(result.html).not.toContain("--custom-tone");
  });

  it("safely degrades font and color styling on native list markers", async () => {
    const theme = cloneWechatThemeManifest(getWechatTheme("loby-basic"));
    theme.id = "marker-style-theme";
    theme.kind = "personal";
    theme.custom = {
      css: '[data-loby-role="article-body"] li::marker { color: var(--loby-accent); font-weight: 700; }',
      htmlTransforms: [],
    };

    const result = await renderWechatArticle({
      title: "列表样式",
      markdown: "# 列表样式\n\n- 第一项\n- 第二项",
      themeId: theme.id,
      theme,
    });

    expect(result.compatibilityWarnings).toEqual([]);
    expect(result.html).toContain("第一项");
    expect(result.html).toContain("第二项");
  });

  it("warns when a marker rule changes marker content or structure", async () => {
    const theme = cloneWechatThemeManifest(getWechatTheme("loby-basic"));
    theme.id = "custom-marker-content-theme";
    theme.kind = "personal";
    theme.custom = {
      css: '[data-loby-role="article-body"] li::marker { content: "→"; color: var(--loby-accent); }',
      htmlTransforms: [],
    };

    const result = await renderWechatArticle({
      title: "列表样式",
      markdown: "# 列表样式\n\n- 第一项",
      themeId: theme.id,
      theme,
    });

    expect(result.compatibilityWarnings).toEqual(['公众号输出无法保留列表标记样式：[data-loby-role="article-body"] li::marker']);
    expect(result.html).toContain("第一项");
    expect(result.html).not.toContain("→");
  });

  it("reports a clear compatibility warning when an unnormalized legacy theme reaches the renderer", async () => {
    const theme = cloneWechatThemeManifest(getWechatTheme("loby-basic"));
    theme.id = "legacy-render-theme";
    theme.kind = "personal";
    theme.custom = {
      css: '[data-nibva-role="article-body"] h2{color:var(--nibva-accent)}',
      htmlTransforms: [{ selector: '[data-nibva-publish="wechat"]', operation: "append", html: "<p>落款</p>" }],
    };

    const result = await renderWechatArticle({ title: "备用标题", markdown: ARTICLE, themeId: theme.id, theme });

    expect(result.compatibilityWarnings).toEqual([expect.stringContaining("旧版样式命名")]);
    expect(result.html).not.toContain("落款");
  });

  it("maps every universal manual control to inline output", async () => {
    const theme = cloneWechatThemeManifest(getWechatTheme("loby-basic"));
    theme.id = "manual-controls-theme";
    theme.kind = "personal";
    theme.baseStyle = {
      typography: {
        articleTitleSize: 31,
        h2Size: 27,
        h3Size: 21,
        h4Size: 17,
        bodySize: 16,
        bodyLineHeight: 2.1,
        paragraphSpacing: 23,
      },
      colors: {
        accent: "#24513B",
        pageBackground: "#FAF8F2",
        titleText: "#181818",
        bodyText: "#343434",
        emphasisText: "#8A2D2D",
        linkText: "#24513B",
        markColor: "#FFF2A8",
      },
      layout: { contentPadding: 19, sectionSpacing: 44, radius: 7, imageRadius: 9, shadowStrength: 1.5 },
    };
    theme.custom = {
      css: "",
      htmlTransforms: [{ selector: '[data-loby-role="article-body"] p', operation: "append", html: "<mark>标记</mark>" }],
    };

    const result = await renderWechatArticle({ title: "备用标题", markdown: ARTICLE, themeId: theme.id, theme });
    const documentNode = new DOMParser().parseFromString(result.html, "text/html");
    const root = documentNode.querySelector<HTMLElement>('[data-loby-publish="wechat"]')!;
    const header = documentNode.querySelector<HTMLElement>('[data-loby-role="article-header"]')!;
    const title = documentNode.querySelector<HTMLElement>('[data-loby-role="article-title"]')!;
    const paragraph = documentNode.querySelector<HTMLElement>('[data-loby-role="article-body"] p')!;
    const h2 = documentNode.querySelector<HTMLElement>("h2")!;
    const h3 = documentNode.querySelector<HTMLElement>("h3")!;
    const h4 = documentNode.querySelector<HTMLElement>("h4")!;
    const strong = documentNode.querySelector<HTMLElement>("strong")!;
    const link = documentNode.querySelector<HTMLElement>("a")!;
    const mark = documentNode.querySelector<HTMLElement>("mark")!;
    const image = documentNode.querySelector<HTMLElement>("img")!;
    const pre = documentNode.querySelector<HTMLElement>("pre")!;

    expect(root.style.background).toBe("#FAF8F2");
    expect(header.style.marginLeft).toBe("19px");
    expect(title.style.fontSize).toBe("31px");
    expect(paragraph.style.fontSize).toBe("16px");
    expect(paragraph.style.lineHeight).toBe("2.1");
    expect(paragraph.style.marginBottom).toBe("23px");
    expect(h2.style.fontSize).toBe("27px");
    expect(h2.style.marginTop).toBe("44px");
    expect(h3.style.fontSize).toBe("21px");
    expect(h4.style.fontSize).toBe("17px");
    expect(strong.style.color).toBe("#8A2D2D");
    expect(link.style.color).toBe("#24513B");
    expect(mark.style.background).toBe("#FFF2A8");
    expect(image.style.borderRadius).toBe("9px");
    expect(image.style.boxShadow).toContain("0.075");
    expect(pre.style.borderRadius).toBe("7px");
  });

  it("accepts arbitrary reusable HTML fragments while preserving article content", async () => {
    const theme = cloneWechatThemeManifest(getWechatTheme("loby-basic"));
    theme.id = "open-root-theme";
    theme.kind = "personal";
    theme.custom = {
      css: ".open-shell{border:2px solid var(--loby-accent)} .open-signature{color:var(--loby-accent)}",
      htmlTransforms: [
        {
          selector: '[data-loby-publish="wechat"]',
          operation: "replace",
          html: '<article class="open-shell">{{content}}</article><footer class="open-signature">自由落款</footer>',
        },
      ],
    };

    const result = await renderWechatArticle({ title: "备用标题", markdown: ARTICLE, themeId: theme.id, theme });

    expect(result.html).toContain('class="open-shell"');
    expect(result.html).toContain("自由落款");
    expect(result.html).toContain("这是一段包含");
    expect(result.html).toContain("示例图片");
    expect(result.compatibilityWarnings).not.toEqual(expect.arrayContaining([expect.stringContaining("改写文章内容")]));
  });

  it("skips local images while preserving data and remote sources in the WeChat clipboard", () => {
    const fetchImage = vi.fn();
    vi.stubGlobal("fetch", fetchImage);

    const result = prepareWechatClipboardHtml(
      '<section><p id="local-wrapper"><img id="cover" src="/src/assets/sample-cover.png"></p><img id="asset" src="http://asset.localhost/cover.png"><img id="inline" src="data:image/svg+xml,%3Csvg%2F%3E"><img id="remote" src="https://example.com/image.png"></section>',
    );
    const documentNode = new DOMParser().parseFromString(result, "text/html");

    expect(fetchImage).not.toHaveBeenCalled();
    expect(documentNode.querySelector("#cover")).toBeNull();
    expect(documentNode.querySelector("#asset")).toBeNull();
    expect(documentNode.querySelector("#local-wrapper")).toBeNull();
    expect(documentNode.querySelector<HTMLImageElement>("#inline")?.getAttribute("src")).toBe("data:image/svg+xml,%3Csvg%2F%3E");
    expect(documentNode.querySelector<HTMLImageElement>("#remote")?.getAttribute("src")).toBe("https://example.com/image.png");
  });

  it("writes rich clipboard HTML without local images or local file reads", async () => {
    const originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    const fetchImage = vi.fn();
    const write = vi.fn(async (_items: unknown[]) => undefined);
    class TestClipboardItem {
      constructor(readonly items: Record<string, Blob>) {}
    }

    vi.stubGlobal("fetch", fetchImage);
    vi.stubGlobal("ClipboardItem", TestClipboardItem);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { write } });

    try {
      await copyWechatHtml(
        '<section><img src="/src/assets/cover.png"><strong>正文</strong><img src="https://example.com/remote.png"></section>',
      );

      expect(fetchImage).not.toHaveBeenCalled();
      expect(write).toHaveBeenCalledOnce();
      const item = write.mock.calls[0][0][0] as unknown as TestClipboardItem;
      const htmlBlob = item.items["text/html"];
      const clipboardHtml = await htmlBlob.text();

      expect(clipboardHtml).not.toContain("/src/assets/cover.png");
      expect(clipboardHtml).toContain('src="https://example.com/remote.png"');
    } finally {
      if (originalClipboard) Object.defineProperty(navigator, "clipboard", originalClipboard);
      else Reflect.deleteProperty(navigator, "clipboard");
      vi.unstubAllGlobals();
    }
  });

  it("copies the rich layout through a WebKit DOM selection after staging the summary and title natively", async () => {
    nativeClipboard.available.mockReturnValue(true);
    vi.spyOn(navigator, "platform", "get").mockReturnValue("MacIntel");
    let copiedHtml = "";
    const clipboardData = { setData: vi.fn() };
    const execCommand = vi.fn(() => {
      const copyRoot = document.querySelector<HTMLElement>('[data-loby-wechat-copy-root="true"]');
      copiedHtml = copyRoot?.innerHTML ?? "";
      const copyEvent = new Event("copy", { bubbles: true, cancelable: true });
      Object.defineProperty(copyEvent, "clipboardData", { value: clipboardData });
      copyRoot?.dispatchEvent(copyEvent);
      return true;
    });
    Object.defineProperty(document, "execCommand", { configurable: true, value: execCommand });

    try {
      await copyWechatArticleToClipboard({
        description: "文章摘要",
        title: "文章标题",
        html: '<section><p data-loby-role="article-title" style="display:none">文章标题</p><img src="/src/assets/cover.png"><strong>正文</strong></section>',
      });

      expect(nativeClipboard.writePrelude).toHaveBeenCalledOnce();
      expect(nativeClipboard.writePrelude).toHaveBeenCalledWith({ description: "文章摘要", title: "文章标题" });
      expect(nativeClipboard.writePrelude.mock.invocationCallOrder[0]).toBeLessThan(execCommand.mock.invocationCallOrder[0]);
      expect(execCommand).toHaveBeenCalledWith("copy");
      expect(copiedHtml).toBe("<section><strong>正文</strong></section>");
      expect(clipboardData.setData).toHaveBeenCalledWith("text/html", "<section><strong>正文</strong></section>");
      expect(clipboardData.setData).toHaveBeenCalledWith("text/plain", "正文");
      expect(document.querySelector('[data-loby-wechat-copy-root="true"]')).toBeNull();
    } finally {
      Reflect.deleteProperty(document, "execCommand");
    }
  });

  it("rejects an HTML transform that rewrites protected article content", async () => {
    const theme = cloneWechatThemeManifest(getWechatTheme("loby-basic"));
    theme.id = "unsafe-content-theme";
    theme.kind = "personal";
    theme.custom = {
      css: "",
      htmlTransforms: [
        {
          selector: '[data-loby-role="article-body"] p',
          operation: "replace-inner",
          html: "这段文字被主题改写了",
        },
      ],
    };

    const result = await renderWechatArticle({ title: "备用标题", markdown: ARTICLE, themeId: theme.id, theme });

    expect(result.html).toContain("这是一段包含");
    expect(result.html).not.toContain("这段文字被主题改写了");
    expect(result.compatibilityWarnings).toEqual(expect.arrayContaining([expect.stringContaining("改写文章内容")]));
  });

  it("degrades unsupported interactive wrappers without deleting protected article content", async () => {
    const theme = cloneWechatThemeManifest(getWechatTheme("loby-basic"));
    theme.id = "interactive-wrapper-theme";
    theme.kind = "personal";
    theme.custom = {
      css: "",
      htmlTransforms: [
        {
          selector: '[data-loby-role="article-body"] h2',
          operation: "replace-inner",
          html: '<button type="button"><span class="decorated-heading">{{content}}</span></button>',
        },
      ],
    };

    const result = await renderWechatArticle({ title: "备用标题", markdown: ARTICLE, themeId: theme.id, theme });

    expect(result.html).toContain('<span class="decorated-heading">第一部分</span>');
    expect(result.html).not.toContain("<button");
    expect(result.compatibilityWarnings).toEqual(expect.arrayContaining([expect.stringContaining("保留其中内容")]));
    expect(result.compatibilityWarnings).not.toEqual(expect.arrayContaining([expect.stringContaining("改写文章内容")]));
  });
});
