/**
 * [INPUT]: 依赖 Vitest、blogPayload 与 shared 写作契约
 * [OUTPUT]: 验证博客 slug、项目配置、图片占位符、文章摘要独立性与项目批量文稿筛选
 * [POS]: publishing model 的博客请求纯转换回归测试，阻止项目描述回流为 Hugo description，并锁定一次批量提交的输入范围
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { describe, expect, it } from "vitest";
import { createBlogSlug, prepareBlogPublishBatchInput, prepareBlogPublishInput } from "@/features/publishing/model/blogPayload";
import type { WritingProject, WritingSheet } from "@/shared/types";
import { createDefaultGitHubBlogTarget } from "@/features/publishing/model/publishingTargets";

const sheet: WritingSheet = {
  id: "sheet-1",
  title: "为什么 Markdown 对 AI 更友好",
  tags: ["AI", "Markdown"],
  targetWords: 1000,
  description: "摘要",
  body: "# 为什么 Markdown 对 AI 更友好\n\n![图](../../../assets/images/test.png)",
  createdAt: "2026-07-24T10:00:00.000Z",
  updatedAt: "2026-07-24",
  properties: {},
};

const project: WritingProject = {
  id: "project-1",
  title: "博客",
  status: "待发布",
  projectGoal: { enabled: false, unit: "words", target: 0 },
  sheets: [sheet],
  updatedAt: "2026-07-24",
};

const target = {
  ...createDefaultGitHubBlogTarget(),
  enabled: true,
  blogName: "麦先生说博客",
  menuLabel: "发布到麦先生说",
  repository: "GeekMai90/maixiansheng-blog",
  siteUrl: "https://blog.geekmailab.com",
};

describe("blogPayload", () => {
  it("requires the canonical document identity for a new public address", () => {
    expect(createBlogSlug(sheet.title, sheet.id)).toBe("");
  });

  it("uses the canonical sheet id payload as the public article id", () => {
    const sourceId = "sheet-0123456789abcdefghjkmnpqrs";
    expect(createBlogSlug("标题不会进入地址", sourceId)).toBe("0123456789abcdefghjkmnpqrs");
  });

  it("maps the app-level target and replaces local images with native placeholders", () => {
    const request = prepareBlogPublishInput("/Library", project, sheet, target, { slug: "article", draft: false });
    expect(request.repository).toBe("GeekMai90/maixiansheng-blog");
    expect(request.description).toBe("摘要");
    expect(request.tags).toEqual(["AI", "Markdown"]);
    expect(request.body).toContain("@@LOBY_BLOG_IMAGE:0@@");
    expect(request.images[0]?.source).toBe("/Library/assets/images/test.png");
  });

  it("omits the article description when the document summary is empty", () => {
    const request = prepareBlogPublishInput("/Library", project, { ...sheet, description: "   " }, target, {
      slug: "article",
      draft: false,
    });

    expect(request.description).toBe("");
  });

  it("prepares every unarchived project document for one Hugo commit", () => {
    const first = { ...sheet, id: "sheet-0123456789abcdefghjkmnpqrs", body: "# 第一篇" };
    const second = { ...sheet, id: "sheet-0123456789abcdefghjkmnpqrt", title: "第二篇", body: "# 第二篇" };
    const archived = { ...sheet, id: "sheet-0123456789abcdefghjkmnpqrv", title: "已归档", body: "# 已归档", archivedAt: "2026-08-01" };
    const request = prepareBlogPublishBatchInput("/Library", { ...project, sheets: [first, second, archived] }, target);

    expect(request.projectTitle).toBe("博客");
    expect(request.documents).toHaveLength(2);
    expect(request.documents.map((document) => document.sourceId)).toEqual([first.id, second.id]);
    expect(request.documents.map((document) => document.slug)).toEqual(["0123456789abcdefghjkmnpqrs", "0123456789abcdefghjkmnpqrt"]);
  });
});
