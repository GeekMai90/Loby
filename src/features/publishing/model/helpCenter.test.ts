/**
 * [INPUT]: 依赖 Vitest、帮助中心纯模型与 shared 写作契约
 * [OUTPUT]: 验证自动分组映射、待整理排除、手动目录稳定性以及单篇/整项目共用 payload
 * [POS]: publishing model 的帮助中心回归边界，保护项目到 GitHub 目录映射与稳定公开 URL
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { describe, expect, it } from "vitest";
import { createHelpCenterBinding, normalizeHelpCenterBinding, prepareHelpCenterSyncInput } from "@/features/publishing/model/helpCenter";
import type { WritingProject } from "@/shared/types";

describe("helpCenter", () => {
  it("automatically maps new groups while excluding 待整理", () => {
    const project = sampleProject();
    const binding = createHelpCenterBinding(project);

    expect(binding.groupMappings).toEqual([
      { groupId: "group-default", directory: "", enabled: false },
      { groupId: "group-start", directory: "开始使用", enabled: true },
    ]);
  });

  it("keeps manual directories stable and adds later groups without duplicates", () => {
    const project = sampleProject();
    project.helpCenterBinding = {
      ...createHelpCenterBinding(project),
      repository: "GeekMai90/loby-help-center",
      siteUrl: "https://loby-help.geekmailab.com",
      groupMappings: [
        { groupId: "group-default", directory: "", enabled: false },
        { groupId: "group-start", directory: "guide", enabled: true },
      ],
    };
    project.groups?.push({ id: "group-guide", title: "guide" });

    expect(normalizeHelpCenterBinding(project)?.groupMappings).toEqual([
      { groupId: "group-default", directory: "", enabled: false },
      { groupId: "group-start", directory: "guide", enabled: true },
      { groupId: "group-guide", directory: "guide-2", enabled: true },
    ]);
  });

  it("uses the same document packing rules for project and single-document sync", () => {
    const project = sampleProject();
    project.helpCenterBinding = {
      ...createHelpCenterBinding(project),
      repository: "GeekMai90/loby-help-center",
      siteUrl: "https://loby-help.geekmailab.com",
    };

    const full = prepareHelpCenterSyncInput("/tmp/library", project);
    const single = prepareHelpCenterSyncInput("/tmp/library", project, "sheet-01hzy3j7yn0000000000000000");

    expect(full.mode).toBe("project");
    expect(full.deleteMissing).toBe(false);
    expect(single.mode).toBe("document");
    expect(single.documents).toEqual(full.documents);
    expect(single.documents[0]).toMatchObject({ groupDirectory: "开始使用", slug: "01hzy3j7yn0000000000000000" });
  });
});

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
