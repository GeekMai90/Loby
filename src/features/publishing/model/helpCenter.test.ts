/**
 * [INPUT]: 依赖 Vitest、Starlight 适配模型、项目发布绑定与 shared 写作契约
 * [OUTPUT]: 验证同名中文目录映射、待整理排除、手动目录稳定性以及单篇/整项目共用 payload
 * [POS]: publishing model 的 Starlight 适配回归边界，保护项目绑定与 GitHub 目录映射
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { describe, expect, it } from "vitest";
import {
  createProjectPublishingBinding,
  normalizeProjectPublishingBinding,
  prepareHelpCenterSyncInput,
} from "@/features/publishing/model/helpCenter";
import { createDefaultGitHubDocsTarget } from "@/features/publishing/model/publishingTargets";
import type { WritingProject } from "@/shared/types";

describe("helpCenter", () => {
  it("automatically maps new groups while excluding 待整理", () => {
    const project = sampleProject();
    const target = sampleTarget();
    const binding = createProjectPublishingBinding(project, target);

    expect(binding.groupMappings).toEqual([
      { groupId: "group-default", directory: "", enabled: false },
      { groupId: "group-start", directory: "开始使用", enabled: true },
    ]);
  });

  it("keeps manual directories stable and gives later groups same-name Chinese directories", () => {
    const project = sampleProject();
    const target = sampleTarget();
    project.publishingBinding = {
      targetId: target.id,
      groupMappings: [
        { groupId: "group-default", directory: "", enabled: false },
        { groupId: "group-start", directory: "guide", enabled: true },
      ],
    };
    project.groups?.push({ id: "group-guide", title: "使用技巧" });

    expect(normalizeProjectPublishingBinding(project, target).groupMappings).toEqual([
      { groupId: "group-default", directory: "", enabled: false },
      { groupId: "group-start", directory: "guide", enabled: true },
      { groupId: "group-guide", directory: "使用技巧", enabled: true },
    ]);
  });

  it("uses target parameters and the same packing rules for project and single-document sync", () => {
    const project = sampleProject();
    const target = sampleTarget();
    project.publishingBinding = createProjectPublishingBinding(project, target);

    const full = prepareHelpCenterSyncInput("/tmp/library", project, target);
    const single = prepareHelpCenterSyncInput("/tmp/library", project, target, "sheet-01hzy3j7yn0000000000000000");

    expect(full).toMatchObject({ repository: "GeekMai90/loby-help-center", contentRoot: "src/content/docs", mode: "project" });
    expect(full.deleteMissing).toBe(false);
    expect(single.mode).toBe("document");
    expect(single.documents).toEqual(full.documents);
    expect(single.documents[0]).toMatchObject({ groupDirectory: "开始使用", slug: "01hzy3j7yn0000000000000000" });
  });
});

function sampleTarget() {
  return {
    ...createDefaultGitHubDocsTarget(),
    id: "github-docs-help",
    siteName: "落笔帮助中心",
    repository: "GeekMai90/loby-help-center",
    siteUrl: "https://loby-help.geekmailab.com",
  };
}

function sampleProject(): WritingProject {
  return {
    id: "project-help",
    title: "落笔帮助中心",
    status: "构思",
    updatedAt: "2026-07-30",
    groups: [
      { id: "group-default", title: "待整理" },
      { id: "group-start", title: "开始使用" },
    ],
    sheets: [
      {
        id: "sheet-01hzy3j7yn0000000000000000",
        title: "认识落笔",
        groupId: "group-start",
        status: "构思",
        tags: [],
        targetWords: 0,
        description: "",
        body: "正文",
        createdAt: "2026-07-30",
        updatedAt: "2026-07-30",
        properties: {},
      },
    ],
  };
}
