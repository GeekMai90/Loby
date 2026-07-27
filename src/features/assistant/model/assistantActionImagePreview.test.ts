import { describe, expect, it, vi } from "vitest";
import { buildInsertImageActionPreview } from "@/features/assistant/model/assistantActionImagePreview";
import { createDefaultInboxProject, INBOX_GROUP_ID } from "@/features/library/model/projectModel";
import type { AiAction, WritingProject, WritingSheet } from "@/shared/types";

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (path: string) => `asset:${path}`,
}));

describe("buildInsertImageActionPreview", () => {
  it("uses the generated cache artifact until the image action is confirmed", () => {
    const project = createDefaultInboxProject();
    const targetSheet = sheet("sheet-generated", "Markdown 样式测试文章");
    const sourceArtifactPath = "/Users/example/Library/Caches/Loby/generated-images/loby-generated.png";
    const action: AiAction = {
      id: "action-generated",
      type: "insertImage",
      status: "proposed",
      title: "插入 Every 风格封面图",
      summary: "等待确认",
      payload: { path: "../assets/images/loby-generated.png", alt: "Every 风格封面" },
      sourceArtifactPath,
      createdAt: "2026-07-27T08:34:47.852Z",
      targetProjectId: project.id,
      targetSheetId: targetSheet.id,
    };

    expect(
      buildInsertImageActionPreview(action, {
        libraryPath: "/Users/example/Loby",
        activeProject: { ...project, sheets: [targetSheet] },
        activeSheet: targetSheet,
      }),
    ).toEqual({
      src: `asset:${sourceArtifactPath}`,
      alt: "Every 风格封面",
      label: "../assets/images/loby-generated.png",
      sourcePath: sourceArtifactPath,
    });
  });

  it("builds a visible preview for an image generated beside the system inbox", () => {
    const project = createDefaultInboxProject();
    const sheet: WritingSheet = {
      id: "sheet-1",
      title: "落笔开发日记",
      groupId: INBOX_GROUP_ID,
      status: "待配图",
      tags: [],
      targetWords: 1000,
      description: "",
      body: "# 落笔开发日记",
      createdAt: "2026-07-18",
      updatedAt: "2026-07-18",
      properties: {},
    };
    const action: AiAction = {
      id: "action-1",
      type: "insertImage",
      status: "proposed",
      title: "插入图片：落笔文档管理",
      summary: "建议向当前文稿插入图片引用。",
      payload: {
        path: "../assets/images/loby-document-management-every-cover.png",
        alt: "落笔文档管理",
      },
      createdAt: "2026-07-18T13:00:00.000Z",
      targetProjectId: project.id,
      targetSheetId: sheet.id,
    };

    expect(
      buildInsertImageActionPreview(action, {
        libraryPath: "/Users/example/Loby",
        activeProject: project,
        activeSheet: sheet,
      }),
    ).toEqual({
      src: "asset:/Users/example/Loby/assets/images/loby-document-management-every-cover.png",
      alt: "落笔文档管理",
      label: "../assets/images/loby-document-management-every-cover.png",
      sourcePath: "/Users/example/Loby/assets/images/loby-document-management-every-cover.png",
    });
  });

  it("keeps a historical target image visible after the active document changes", () => {
    const targetSheet = sheet("target-sheet", "目标文稿");
    const targetProject = project("target-project", "目标项目", targetSheet);
    const activeSheet = sheet("active-sheet", "当前文稿");
    const activeProject = project("active-project", "当前项目", activeSheet);
    const action: AiAction = {
      id: "action-history",
      type: "insertImage",
      status: "rejected",
      title: "插入图片：历史配图",
      summary: "曾经生成的图片",
      payload: { path: "../../../assets/images/history.png", alt: "历史配图" },
      createdAt: "2026-07-18T13:00:00.000Z",
      targetProjectId: targetProject.id,
      targetSheetId: targetSheet.id,
    };

    expect(
      buildInsertImageActionPreview(action, {
        libraryPath: "/Users/example/Loby",
        projects: [targetProject, activeProject],
        activeProject,
        activeSheet,
      })?.sourcePath,
    ).toBe("/Users/example/Loby/assets/images/history.png");
  });

  it("resolves a historical image from the sheet's current project after the sheet moves", () => {
    const movedSheet = sheet("moved-sheet", "已移动文稿");
    const previousProject = project("inbox-root", "收件箱", sheet("other-sheet", "其他文稿"));
    const currentProject = project("blog-project", "博客", movedSheet);
    const action: AiAction = {
      id: "action-moved",
      type: "insertImage",
      status: "applied",
      title: "插入图片：历史封面",
      summary: "已经插入的历史封面",
      payload: { path: "../assets/images/history-cover.png", alt: "历史封面" },
      sourceArtifactPath: "/Users/example/Library/Caches/Loby/generated-images/history-cover.png",
      createdAt: "2026-07-24T12:27:46.313Z",
      targetProjectId: previousProject.id,
      targetSheetId: movedSheet.id,
    };

    expect(
      buildInsertImageActionPreview(action, {
        libraryPath: "/Users/example/Loby",
        projects: [previousProject, currentProject],
        activeProject: currentProject,
        activeSheet: movedSheet,
      })?.sourcePath,
    ).toBe("/Users/example/Loby/assets/images/history-cover.png");
  });
});

function sheet(id: string, title: string): WritingSheet {
  return {
    id,
    title,
    groupId: "group-1",
    status: "待配图",
    tags: [],
    targetWords: 1000,
    description: "",
    body: `# ${title}`,
    createdAt: "2026-07-18",
    updatedAt: "2026-07-18",
    properties: {},
  };
}

function project(id: string, title: string, targetSheet: WritingSheet): WritingProject {
  return {
    id,
    title,
    status: "待配图",
    projectGoal: { enabled: false, unit: "words", target: 0 },
    groups: [{ id: "group-1", title: "正文" }],
    sheets: [targetSheet],
    updatedAt: "2026-07-18",
  };
}
