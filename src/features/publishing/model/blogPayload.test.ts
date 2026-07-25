/**
 * [INPUT]: 依赖 Vitest、blogPayload 与 shared 写作契约
 * [OUTPUT]: 验证博客 slug、项目配置、图片占位符与文章摘要独立性
 * [POS]: publishing model 的博客请求纯转换回归测试，阻止项目描述回流为 Hugo description
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { describe, expect, it } from "vitest";
import { createBlogSlug, prepareBlogPublishInput } from "@/features/publishing/model/blogPayload";
import type { WritingProject, WritingSheet } from "@/shared/types";

const sheet: WritingSheet = {
  id: "sheet-1",
  title: "为什么 Markdown 对 AI 更友好",
  status: "待发布",
  targetWords: 1000,
  summary: "摘要",
  body: "# 为什么 Markdown 对 AI 更友好\n\n![图](../../../assets/images/test.png)",
  createdAt: "2026-07-24T10:00:00.000Z",
  updatedAt: "2026-07-24",
  properties: { tags: ["AI", "Markdown"] },
};

const project: WritingProject = {
  id: "project-1",
  title: "博客",
  description: "博客项目",
  status: "待发布",
  targetPlatform: "博客",
  targetWords: 0,
  tags: ["写作"],
  sheets: [sheet],
  updatedAt: "2026-07-24",
  blogPublishing: {
    enabled: true,
    name: "麦先生说博客",
    repository: "GeekMai90/maixiansheng-blog",
    branch: "main",
    contentRoot: "content/posts",
    siteUrl: "https://blog.geekmailab.com",
  },
};

describe("blogPayload", () => {
  it("requires the canonical document identity for a new public address", () => {
    expect(createBlogSlug(sheet.title, sheet.id)).toBe("");
  });

  it("uses the canonical sheet id payload as the public article id", () => {
    const sourceId = "sheet-0123456789abcdefghjkmnpqrs";
    expect(createBlogSlug("标题不会进入地址", sourceId)).toBe("0123456789abcdefghjkmnpqrs");
  });

  it("maps project settings and replaces local images with native placeholders", () => {
    const request = prepareBlogPublishInput("/Library", project, sheet, { slug: "article", draft: false });
    expect(request.repository).toBe("GeekMai90/maixiansheng-blog");
    expect(request.summary).toBe("摘要");
    expect(request.tags).toEqual(["AI", "Markdown"]);
    expect(request.body).toContain("@@LOBY_BLOG_IMAGE:0@@");
    expect(request.images[0]?.source).toBe("/Library/assets/images/test.png");
  });

  it("omits the article description instead of falling back to the project description", () => {
    const request = prepareBlogPublishInput("/Library", project, { ...sheet, summary: "   " }, { slug: "article", draft: false });

    expect(request.summary).toBe("");
    expect(request.summary).not.toBe(project.description);
  });
});
