import { describe, expect, it, vi } from "vitest";
import { buildInsertImageActionPreview } from "./assistantActionImagePreview";
import { createDefaultInboxProject, INBOX_GROUP_ID } from "./projectModel";
import type { AiAction, WritingSheet } from "../types";

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (path: string) => `asset:${path}`,
}));

describe("buildInsertImageActionPreview", () => {
  it("builds a visible preview for an image generated beside the system inbox", () => {
    const project = createDefaultInboxProject();
    const sheet: WritingSheet = {
      id: "sheet-1",
      title: "落笔开发日记",
      groupId: INBOX_GROUP_ID,
      type: "正文",
      status: "待配图",
      targetWords: 1000,
      summary: "",
      body: "# 落笔开发日记",
      updatedAt: "2026-07-18",
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
});
