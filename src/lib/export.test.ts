import { describe, expect, it } from "vitest";
import type { WritingProject, WritingSheet } from "../types";
import {
  compileHtml,
  compileMarkdown,
  compilePlainText,
  compileWechatHtml,
  compileXhsDraft,
  getPublishableSheets,
  renderMarkdownHtml,
} from "./export";

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

describe("project export compilation", () => {
  it("excludes material sheets by default while preserving project order", () => {
    const first = createSheet("first", "第一篇", "正文", "第一篇正文");
    const material = createSheet("material", "素材", "素材", "内部素材");
    const second = createSheet("second", "第二篇", "章节", "第二篇正文");
    const project = createProject([first, material, second]);

    expect(getPublishableSheets(project).map((sheet) => sheet.id)).toEqual(["first", "second"]);
    expect(compilePlainText(project)).toBe("第一篇正文\n\n第二篇正文");
  });

  it("honors explicit sheet order and body transforms in Markdown bundles", () => {
    const first = createSheet("first", "第一篇", "正文", "原始一");
    const second = createSheet("second", "第二篇", "章节", "原始二");
    const markdown = compileMarkdown(createProject([first, second]), [second, first], {
      transformSheetBody: (sheet) => `转换-${sheet.id}`,
    });

    expect(markdown).toContain("title: 导出项目");
    expect(markdown).toContain("tags: [写作, 测试]");
    expect(markdown.indexOf("转换-second")).toBeLessThan(markdown.indexOf("转换-first"));
    expect(markdown).not.toContain("原始一");
  });

  it("escapes the document title and sheet identifier in compiled HTML", async () => {
    const sheet = createSheet('sheet-"unsafe', "正文", "正文", "# 标题\n\n正文");
    const project = { ...createProject([sheet]), title: '<script>alert("title")</script>' };
    const html = await compileHtml(project, [sheet], { transformSheetBody: () => "## 已转换" });

    expect(html).toContain('<title>&lt;script&gt;alert("title")&lt;/script&gt;</title>');
    expect(html).toContain('data-sheet-id="sheet-&quot;unsafe"');
    expect(html).toContain("<h2>已转换</h2>");
    expect(html).not.toContain("<h1>标题</h1>");
  });

  it("normalizes portable plain text and WeChat task/image markup", () => {
    const sheet = createSheet("sheet", "正文", "正文", "# 标题\n\n- [x] **完成**\n\n![[assets/images/cover.png|封面]]\n\n<script>");
    const project = createProject([sheet]);

    expect(compilePlainText(project)).toBe("标题\n\n完成\n\n封面\n\n<script>");
    const wechat = compileWechatHtml(project);
    expect(wechat).toContain("☑ <strong>完成</strong>");
    expect(wechat).toContain('src="assets/images/cover.png" alt="封面"');
    expect(wechat).toContain("&lt;script&gt;");
  });

  it("uses the content fallback when a project has no tags in the XHS draft", () => {
    const project = { ...createProject([createSheet("sheet", "正文", "正文", "正文素材")]), tags: [] };

    expect(compileXhsDraft(project)).toContain("- 写给正在做内容的人");
  });
});

function createProject(sheets: WritingSheet[]): WritingProject {
  return {
    id: "project",
    title: "导出项目",
    description: "",
    status: "构思",
    targetPlatform: "公众号",
    targetWords: 1000,
    tags: ["写作", "测试"],
    groups: [{ id: "group", title: "正文", icon: "article", iconColor: "#007aff", description: "" }],
    sheets,
    updatedAt: "2026-07-17T10:00:00+08:00",
  };
}

function createSheet(id: string, title: string, type: WritingSheet["type"], body: string): WritingSheet {
  return {
    id,
    title,
    groupId: "group",
    type,
    status: "构思",
    targetWords: 1000,
    summary: `${title}摘要`,
    body,
    updatedAt: "2026-07-17T10:00:00+08:00",
  };
}
