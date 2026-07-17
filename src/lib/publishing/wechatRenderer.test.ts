// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cloneWechatThemeManifest, getWechatThemeValidationIssues } from "./wechatThemeModel";
import { prepareWechatClipboardHtml, renderWechatArticle } from "./wechatRenderer";
import { getWechatTheme } from "./wechatThemes";

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
const theme = "nibva";
\`\`\`
`;

describe("wechat renderer", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("compiles the deep-blue open theme to inline WeChat HTML", async () => {
    const result = await renderWechatArticle({
      title: "备用标题",
      markdown: ARTICLE,
      summary: "用于测试公众号主题渲染。",
      date: "2026-07-16",
      tags: ["AI", "写作"],
      themeId: "deep-blue-study",
    });

    expect(result.title).toBe("用 AI 打磨公众号主题");
    expect(result.compatibilityWarnings).toEqual([]);
    expect(result.html).toContain('data-theme="deep-blue-study"');
    expect(result.html).toContain("麦先生说");
    expect(result.html).toContain("2026-07-16");
    expect(result.html).toContain(">01<");
    expect(result.html).toContain("如果对你有用");
    expect(result.html).toContain("font-size: 15px");
    expect(result.html).not.toContain("<style");
    expect(result.readingMinutes).toBeGreaterThanOrEqual(1);
  });

  it("compiles editorial HTML transforms without requiring optional modules in the base model", async () => {
    const result = await renderWechatArticle({
      title: "备用标题",
      markdown: ARTICLE,
      date: "2026-07-16",
      tags: ["不应显示"],
      themeId: "cream-paper",
    });

    expect(result.html).toContain("SECTION 01");
    expect(result.html).toContain("预计阅读");
    expect(result.html).toContain("写到这里，刚好停下。");
    expect(result.html).not.toContain("不应显示");
  });

  it("applies free AI-authored CSS and HTML, then removes executable markup", async () => {
    const theme = cloneWechatThemeManifest(getWechatTheme("deep-blue-study"));
    theme.id = "my-open-theme";
    theme.kind = "personal";
    theme.name = "自由主题";
    theme.baseThemeId = "deep-blue-study";
    theme.baseStyle.colors.accent = "#24513B";
    theme.custom = {
      css: '[data-nibva-role="article-body"] h2{background:#F0F8F3;border-left:4px solid var(--nibva-accent)} h3::before{content:"✦";color:var(--nibva-accent);margin-right:6px}',
      htmlTransforms: [
        {
          selector: '[data-nibva-role="article-body"] h2',
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
    const theme = cloneWechatThemeManifest(getWechatTheme("deep-blue-study"));
    theme.id = "cascade-theme";
    theme.kind = "personal";
    theme.custom = {
      css: `
        [data-nibva-publish="wechat"] { --custom-tone:#24513B; }
        [data-nibva-role="article-body"] h2 { --custom-gap:12px; color:#123456; margin-left:var(--custom-gap); }
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

  it("maps every universal manual control to inline output", async () => {
    const theme = cloneWechatThemeManifest(getWechatTheme("deep-blue-study"));
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
      htmlTransforms: [{ selector: '[data-nibva-role="article-body"] p', operation: "append", html: "<mark>标记</mark>" }],
    };

    const result = await renderWechatArticle({ title: "备用标题", markdown: ARTICLE, themeId: theme.id, theme });
    const documentNode = new DOMParser().parseFromString(result.html, "text/html");
    const root = documentNode.querySelector<HTMLElement>('[data-nibva-publish="wechat"]')!;
    const header = documentNode.querySelector<HTMLElement>('[data-nibva-role="article-header"]')!;
    const title = documentNode.querySelector<HTMLElement>('[data-nibva-role="article-title"]')!;
    const paragraph = documentNode.querySelector<HTMLElement>('[data-nibva-role="article-body"] p')!;
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
    const theme = cloneWechatThemeManifest(getWechatTheme("deep-blue-study"));
    theme.id = "open-root-theme";
    theme.kind = "personal";
    theme.custom = {
      css: ".open-shell{border:2px solid var(--nibva-accent)} .open-signature{color:var(--nibva-accent)}",
      htmlTransforms: [
        {
          selector: '[data-nibva-publish="wechat"]',
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

  it("inlines app-local images for the WeChat clipboard while preserving data and remote sources", async () => {
    const fetchImage = vi.fn(async () => new Response(new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" })));
    vi.stubGlobal("fetch", fetchImage);

    const result = await prepareWechatClipboardHtml(
      '<section><img id="cover" src="/src/assets/sample-cover.png"><img id="inline" src="data:image/svg+xml,%3Csvg%2F%3E"><img id="remote" src="https://example.com/image.png"></section>',
    );
    const documentNode = new DOMParser().parseFromString(result, "text/html");

    expect(fetchImage).toHaveBeenCalledTimes(1);
    expect(fetchImage).toHaveBeenCalledWith("/src/assets/sample-cover.png");
    expect(documentNode.querySelector<HTMLImageElement>("#cover")?.src).toBe("data:image/png;base64,iVBORw==");
    expect(documentNode.querySelector<HTMLImageElement>("#inline")?.getAttribute("src")).toBe("data:image/svg+xml,%3Csvg%2F%3E");
    expect(documentNode.querySelector<HTMLImageElement>("#remote")?.src).toBe("https://example.com/image.png");
  });

  it("rejects an HTML transform that rewrites protected article content", async () => {
    const theme = cloneWechatThemeManifest(getWechatTheme("deep-blue-study"));
    theme.id = "unsafe-content-theme";
    theme.kind = "personal";
    theme.custom = {
      css: "",
      htmlTransforms: [
        {
          selector: '[data-nibva-role="article-body"] p',
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
    const theme = cloneWechatThemeManifest(getWechatTheme("deep-blue-study"));
    theme.id = "interactive-wrapper-theme";
    theme.kind = "personal";
    theme.custom = {
      css: "",
      htmlTransforms: [
        {
          selector: '[data-nibva-role="article-body"] h2',
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
