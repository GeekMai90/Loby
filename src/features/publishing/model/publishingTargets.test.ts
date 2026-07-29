/**
 * [INPUT]: 依赖 Vitest 与应用级发布目标纯模型
 * [OUTPUT]: 验证空仓库默认值、自用模板、启用条件、跨项目目标筛选与不可变替换
 * [POS]: publishing model 的应用级模板与已添加目标 registry 回归测试
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { describe, expect, it } from "vitest";
import {
  createDefaultGitHubBlogTarget,
  createDefaultPublishingTargetStore,
  createMaixianshengGitHubBlogTarget,
  enabledGitHubBlogTargets,
  replacePublishingTarget,
} from "@/features/publishing/model/publishingTargets";

describe("publishingTargets", () => {
  it("starts without an implicit target and exposes the private blog only as an addable template", () => {
    expect(createDefaultPublishingTargetStore().targets).toEqual([]);
    expect(createMaixianshengGitHubBlogTarget()).toMatchObject({
      blogName: "麦先生说博客",
      repository: "GeekMai90/maixiansheng-blog",
      enabled: true,
    });
  });

  it("exposes a configured target without consulting a project", () => {
    const target = {
      ...createDefaultGitHubBlogTarget(),
      enabled: true,
      repository: "owner/site",
      siteUrl: "https://example.com",
    };
    const store = replacePublishingTarget(createDefaultPublishingTargetStore(), target);

    expect(enabledGitHubBlogTargets(store)).toEqual([target]);
  });

  it("keeps incomplete enabled targets out of the share menu", () => {
    const target = { ...createDefaultGitHubBlogTarget(), enabled: true };
    const store = replacePublishingTarget(createDefaultPublishingTargetStore(), target);

    expect(enabledGitHubBlogTargets(store)).toEqual([]);
  });
});
