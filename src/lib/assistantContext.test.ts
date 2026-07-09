import { describe, expect, it } from "vitest";
import {
  addUnique,
  buildAvailableDocuments,
  buildChatContextPreviews,
  buildMountedContexts,
  resolveMountedContextsFromPreviews,
} from "./assistantContext";
import type { AiMountedContext, ChatContextPreview, WritingProject, WritingSheet } from "../types";

const sheet: WritingSheet = {
  id: "sheet-1",
  title: "正文",
  groupId: "group-1",
  type: "正文",
  status: "构思",
  targetWords: 1000,
  summary: "摘要",
  body: "正文内容",
  updatedAt: "2026-07-08 10:00:00",
};

const project: WritingProject = {
  id: "project-1",
  title: "项目",
  description: "",
  status: "构思",
  targetPlatform: "公众号",
  targetWords: 1000,
  tags: [],
  groups: [{ id: "group-1", title: "第一组" }],
  sheets: [sheet],
  updatedAt: "2026-07-08 10:00:00",
};

describe("assistantContext", () => {
  it("builds document references from project sheets", () => {
    const documents = buildAvailableDocuments([project]);

    expect(documents).toEqual([
      expect.objectContaining({
        id: "project-1:sheet-1",
        projectId: "project-1",
        sheetId: "sheet-1",
        title: "正文",
        subtitle: "项目 / 第一组 / 正文",
        content: "正文内容",
      }),
    ]);
  });

  it("builds mounted document and selection contexts", () => {
    const documents = buildAvailableDocuments([project]);
    const contexts = buildMountedContexts(sheet, documents, ["sheet-1"], "选中的一段文字");

    expect(contexts.map((context) => context.type)).toEqual(["document", "selection"]);
    expect(contexts[0].subtitle).toBe("当前文稿");
    expect(contexts[1].title).toBe("选中的一段文字");
  });

  it("hides repeated document context but keeps selection visible", () => {
    const contexts: AiMountedContext[] = [
      {
        id: "document:sheet-1",
        type: "document",
        sheetId: "sheet-1",
        projectId: "project-1",
        title: "正文",
        subtitle: "当前文稿",
        content: "正文内容",
      },
      {
        id: "selection:sheet-1",
        type: "selection",
        sheetId: "sheet-1",
        title: "选区",
        subtitle: "选区",
        content: "很长很长的选区内容 ".repeat(5),
      },
    ];

    const previews = buildChatContextPreviews(contexts, false);

    expect(previews[0]).toMatchObject({ type: "document", visible: false, excerpt: "正文" });
    expect(previews[1].visible).toBe(true);
    expect(previews[1].excerpt.length).toBeLessThanOrEqual(47);
  });

  it("resolves previews back to mounted contexts", () => {
    const documents = buildAvailableDocuments([project]);
    const previews: ChatContextPreview[] = [
      { id: "document:sheet-1", type: "document", sheetId: "sheet-1", title: "正文", subtitle: "", excerpt: "正文" },
      { id: "selection:sheet-1", type: "selection", title: "选区", subtitle: "", excerpt: "选区内容" },
    ];

    const contexts = resolveMountedContextsFromPreviews(previews, sheet, documents);

    expect(contexts.map((context) => context.type)).toEqual(["document", "selection"]);
    expect(contexts[0].content).toBe("正文内容");
    expect(contexts[1].content).toBe("选区内容");
  });

  it("adds values only once", () => {
    expect(addUnique(["a"], "a")).toEqual(["a"]);
    expect(addUnique(["a"], "b")).toEqual(["a", "b"]);
  });
});
