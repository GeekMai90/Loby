/**
 * [INPUT]: 依赖 publishing channel 领域模型
 * [OUTPUT]: 验证项目 GitHub 发布渠道使用用户名称并兼容空名称
 * [POS]: publishing model 的发布菜单文案回归测试
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { describe, expect, it } from "vitest";
import { githubPublishChannel } from "@/features/publishing/model/types";

describe("githubPublishChannel", () => {
  it("uses the project configured publishing name as the menu label", () => {
    expect(githubPublishChannel("麦先生说博客")).toEqual({
      id: "blog",
      label: "麦先生说博客",
      description: "发布到“麦先生说博客”配置的 GitHub 仓库",
    });
  });

  it("keeps a readable fallback for legacy configurations", () => {
    expect(githubPublishChannel("  ").label).toBe("GitHub 发布");
  });
});
