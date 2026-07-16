// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import { renderWechatArticle } from "./wechatRenderer";
import { cloneWechatThemeManifest, getWechatThemeValidationIssues } from "./wechatThemeModel";
import { getWechatTheme } from "./wechatThemes";

const ARTICLE = `# 用 AI 打磨公众号主题

这是一段包含 **重点**、*斜体*、[链接](https://example.com) 和 \`代码\` 的正文。

## 第一部分

> 引用内容

### 小标题

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
  it("renders the deep-blue bundled theme with inline styles", async () => {
    const result = await renderWechatArticle({
      title: "备用标题",
      markdown: ARTICLE,
      summary: "用于测试公众号主题渲染。",
      date: "2026-07-16",
      tags: ["AI", "写作"],
      themeId: "deep-blue-study",
    });

    expect(result.title).toBe("用 AI 打磨公众号主题");
    expect(result.html).toContain('data-theme="deep-blue-study"');
    expect(result.html).toContain("麦先生说");
    expect(result.html).toContain("2026-07-16");
    expect(result.html).toContain(">01<");
    expect(result.html).toContain("AI");
    expect(result.html).toContain("https://example.com");
    expect(result.html).toContain("border-collapse: collapse");
    expect(result.html).toContain("如果对你有用");
    expect(result.html).not.toContain("<h1");
    expect(result.readingMinutes).toBeGreaterThanOrEqual(1);
  });

  it("renders the editorial structure and reading stats", async () => {
    const result = await renderWechatArticle({
      title: "备用标题",
      markdown: ARTICLE,
      date: "2026-07-16",
      tags: ["不应显示"],
      themeId: "cream-paper",
    });

    expect(result.html).toContain('data-theme="cream-paper"');
    expect(result.html).toContain("SECTION 01");
    expect(result.html).toContain("预计阅读");
    expect(result.html).toContain("写到这里，刚好停下。");
    expect(result.html).not.toContain("不应显示");
  });

  it("renders a validated personal theme without adding renderer branches", async () => {
    const theme = cloneWechatThemeManifest(getWechatTheme("deep-blue-study"));
    theme.id = "my-blue-theme";
    theme.kind = "personal";
    theme.name = "我的蓝色主题";
    theme.baseThemeId = "deep-blue-study";
    theme.tokens.accent = "#123456";
    theme.brand = {
      author: "自定义作者",
      footerText: "自定义结尾",
      showDate: false,
      showTags: false,
      showReadingStats: true,
    };

    expect(getWechatThemeValidationIssues(theme)).toEqual([]);

    const result = await renderWechatArticle({
      title: "备用标题",
      markdown: ARTICLE,
      date: "2026-07-16",
      tags: ["不应显示"],
      themeId: theme.id,
      theme,
    });

    expect(result.html).toContain('data-theme="my-blue-theme"');
    expect(result.html).toContain("#123456");
    expect(result.html).toContain("自定义作者");
    expect(result.html).toContain("自定义结尾");
    expect(result.html).toContain("预计阅读");
    expect(result.html).not.toContain("2026-07-16");
    expect(result.html).not.toContain("不应显示");
  });
});
