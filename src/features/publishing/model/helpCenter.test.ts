/**
 * [INPUT]: 依赖 Vitest、Starlight 适配模型、项目发布绑定与 shared 写作契约
 * [OUTPUT]: 验证同名中文目录映射、待整理排除、手动目录稳定性、单篇/项目共用 payload 与仅清理请求
 * [POS]: publishing model 的 Starlight 适配回归边界，保护项目绑定与 GitHub 目录映射
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { describe, expect, it } from "vitest";
import {
  applyHelpCenterSyncResult,
  createProjectPublishingBinding,
  helpCenterDocumentSyncState,
  normalizeProjectPublishingBinding,
  prepareHelpCenterSyncInput,
  resolveProjectPublishingBinding,
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

  it("restores the saved directory after temporarily selecting no target", () => {
    const project = sampleProject();
    const target = sampleTarget();
    project.publishingBinding = {
      targetId: target.id,
      groupMappings: [
        { groupId: "group-default", directory: "", enabled: false },
        { groupId: "group-start", directory: "getting-started", enabled: true },
      ],
    };

    const binding = resolveProjectPublishingBinding(project, target, { targetId: "", groupMappings: [] });

    expect(binding.groupMappings).toEqual(project.publishingBinding.groupMappings);
  });

  it("uses target parameters and the same packing rules for project and single-document sync", () => {
    const project = sampleProject();
    const target = sampleTarget();
    project.publishingBinding = createProjectPublishingBinding(project, target);

    const full = prepareHelpCenterSyncInput("/tmp/library", project, target);
    const single = prepareHelpCenterSyncInput("/tmp/library", project, target, {
      sheetId: "sheet-01hzy3j7yn0000000000000000",
    });

    expect(full).toMatchObject({ repository: "GeekMai90/loby-help-center", contentRoot: "src/content/docs", mode: "project" });
    expect(full.deleteMissing).toBe(false);
    expect(single.mode).toBe("document");
    expect(single.documents).toEqual(full.documents);
    expect(single.documents[0]).toMatchObject({ groupDirectory: "开始使用", slug: "01hzy3j7yn0000000000000000" });
  });

  it("includes published and unpublished documents in the same project synchronization", () => {
    const project = sampleProject();
    const target = sampleTarget();
    project.publishingBinding = createProjectPublishingBinding(project, target);
    project.sheets[0].publications = {
      [target.id]: {
        targetKind: "githubDocsSite",
        sourceId: project.sheets[0].id,
        slug: "01hzy3j7yn0000000000000000",
        url: "https://loby-help.geekmailab.com/01hzy3j7yn0000000000000000/",
        lastCommitSha: "previous",
        lastPublishedAt: "2026-07-30",
        sourceHash: "hash",
        draft: false,
      },
    };
    project.sheets.push({
      ...project.sheets[0],
      id: "sheet-01hzy3j7yn0000000000000001",
      title: "安装落笔",
      publications: undefined,
    });

    const request = prepareHelpCenterSyncInput("/tmp/library", project, target);
    expect(request.documents.map((document) => document.sourceId)).toEqual([
      "sheet-01hzy3j7yn0000000000000000",
      "sheet-01hzy3j7yn0000000000000001",
    ]);
  });

  it("allows an empty project payload only for explicit remote cleanup", () => {
    const project = sampleProject();
    const target = sampleTarget();
    project.publishingBinding = createProjectPublishingBinding(project, target);
    project.sheets = [];

    expect(() => prepareHelpCenterSyncInput("/tmp/library", project, target)).toThrow("当前项目没有可发布的文稿");
    expect(prepareHelpCenterSyncInput("/tmp/library", project, target, { deleteMissing: true })).toMatchObject({
      mode: "project",
      deleteMissing: true,
      documents: [],
    });
  });

  it("clears the local target publication after native confirms remote cleanup", () => {
    const project = sampleProject();
    const target = sampleTarget();
    project.sheets[0].publications = {
      [target.id]: {
        targetKind: "githubDocsSite",
        sourceId: project.sheets[0].id,
        slug: "01hzy3j7yn0000000000000000",
        url: "https://loby-help.geekmailab.com/01hzy3j7yn0000000000000000/",
        lastCommitSha: "previous",
        lastPublishedAt: "2026-07-30",
        sourceHash: "hash",
        draft: false,
      },
    };

    const nextProject = applyHelpCenterSyncResult("/tmp/library", project, target, {
      commitSha: "cleanup",
      changed: true,
      syncedCount: 0,
      documents: [],
      deletedCount: 1,
      deletedSourceIds: [project.sheets[0].id],
    });

    expect(nextProject.sheets[0].publications).toBeUndefined();
  });

  it("distinguishes a current document from one modified after publishing", () => {
    const project = sampleProject();
    const target = sampleTarget();
    project.publishingBinding = createProjectPublishingBinding(project, target);
    const synchronized = applyHelpCenterSyncResult("/tmp/library", project, target, {
      commitSha: "published",
      changed: true,
      syncedCount: 1,
      documents: [
        {
          sourceId: project.sheets[0].id,
          slug: "01hzy3j7yn0000000000000000",
          url: "https://loby-help.geekmailab.com/01hzy3j7yn0000000000000000/",
          sourceHash: "hash",
        },
      ],
      deletedCount: 0,
      deletedSourceIds: [],
    });

    expect(helpCenterDocumentSyncState("/tmp/library", synchronized, synchronized.sheets[0], target)).toBe("current");
    const modified = { ...synchronized, sheets: [{ ...synchronized.sheets[0], body: `${synchronized.sheets[0].body}\n\n新增内容` }] };
    expect(helpCenterDocumentSyncState("/tmp/library", modified, modified.sheets[0], target)).toBe("modified");
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
