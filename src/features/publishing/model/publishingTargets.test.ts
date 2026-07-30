/**
 * [INPUT]: 依赖 Vitest 与应用级 GitHub 发布目标纯模型
 * [OUTPUT]: 验证空 registry、Hugo/Starlight 通用适配器、可用性筛选与不可变替换
 * [POS]: publishing model 的适配器模板与用户目标实例 registry 回归测试
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { describe, expect, it } from "vitest";
import {
  createDefaultGitHubBlogTarget,
  createDefaultGitHubDocsTarget,
  createDefaultPublishingTargetStore,
  enabledGitHubPublishingTargets,
  isPublishingTargetReady,
  replacePublishingTarget,
} from "@/features/publishing/model/publishingTargets";

describe("publishingTargets", () => {
  it("starts empty and exposes generic Hugo and Starlight adapters", () => {
    expect(createDefaultPublishingTargetStore().targets).toEqual([]);
    expect(createDefaultGitHubBlogTarget()).toMatchObject({
      kind: "githubHugoBlog",
      blogName: "GitHub 博客",
      contentRoot: "content/posts",
    });
    expect(createDefaultGitHubDocsTarget()).toMatchObject({
      kind: "githubDocsSite",
      siteName: "GitHub 文档网站",
      contentRoot: "src/content/docs",
    });
  });

  it("exposes ready targets without consulting a project", () => {
    const blog = {
      ...createDefaultGitHubBlogTarget(),
      repository: "owner/blog",
      siteUrl: "https://blog.example.com",
    };
    const docs = {
      ...createDefaultGitHubDocsTarget(),
      repository: "owner/docs",
      siteUrl: "https://docs.example.com",
    };
    const store = replacePublishingTarget(replacePublishingTarget(createDefaultPublishingTargetStore(), blog), docs);

    expect(enabledGitHubPublishingTargets(store)).toEqual([blog, docs]);
  });

  it("keeps incomplete targets out of project publishing choices", () => {
    const target = createDefaultGitHubDocsTarget();
    const store = replacePublishingTarget(createDefaultPublishingTargetStore(), target);

    expect(enabledGitHubPublishingTargets(store)).toEqual([]);
  });

  it("accepts configurable Starlight subpaths without allowing unrelated managed roots", () => {
    const target = {
      ...createDefaultGitHubDocsTarget(),
      repository: "owner/docs",
      siteUrl: "https://docs.example.com",
      contentRoot: "src/content/docs/产品手册",
      manifestPath: "src/data/product-docs.json",
      assetsRoot: "public/images/product-docs",
    };

    expect(isPublishingTargetReady(target)).toBe(true);
    expect(isPublishingTargetReady({ ...target, contentRoot: ".github/workflows" })).toBe(false);
    expect(isPublishingTargetReady({ ...target, assetsRoot: "src/assets/docs" })).toBe(false);
    expect(isPublishingTargetReady({ ...target, manifestPath: "src/data/product-docs.yml" })).toBe(false);
  });
});
