/**
 * [INPUT]: 依赖 publishing channel 领域模型
 * [OUTPUT]: 验证发布菜单隐藏暂未开放的渠道，并确保 GitHub 目标使用菜单名称、博客名称和稳定 target ID
 * [POS]: publishing model 的发布菜单文案回归测试
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { describe, expect, it } from "vitest";
import { githubPublishChannel, PUBLISH_CHANNELS } from "@/features/publishing/model/types";
import { createDefaultGitHubBlogTarget } from "@/features/publishing/model/publishingTargets";

describe("githubPublishChannel", () => {
  it("keeps the unavailable WordPress channel out of the document publish menu", () => {
    expect(PUBLISH_CHANNELS.some((channel) => channel.id === "wordpress")).toBe(false);
  });

  it("uses the target menu label without losing its target identity", () => {
    const target = { ...createDefaultGitHubBlogTarget(), blogName: "麦先生说博客", menuLabel: "发布到麦先生说" };
    expect(githubPublishChannel(target)).toEqual({
      id: "blog",
      label: "发布到麦先生说",
      description: "发布到“麦先生说博客”配置的 GitHub 仓库",
      targetId: target.id,
    });
  });

  it("keeps a readable fallback when the menu label is empty", () => {
    expect(githubPublishChannel({ ...createDefaultGitHubBlogTarget(), menuLabel: "  " }).label).toBe("发布到博客");
  });
});
