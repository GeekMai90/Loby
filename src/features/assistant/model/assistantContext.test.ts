import { describe, expect, it } from "vitest";
import {
  addUnique,
  buildAvailableDocuments,
  buildChatContextPreviews,
  buildMountedContexts,
  getChatContextContentMode,
  getChatContextContentModeDescription,
  getChatContextContentModeLabel,
  getChatContextDisplayDescription,
  getChatContextDisplayLabel,
  normalizeSelectionContextText,
  resolveMountedContextsFromPreviews,
} from "@/features/assistant/model/assistantContext";
import type { AiMountedContext, ChatContextPreview, WritingProject, WritingSheet } from "@/shared/types";

const sheet: WritingSheet = {
  id: "sheet-1",
  title: "正文",
  groupId: "group-1",
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
        subtitle: "项目 / 第一组",
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
    expect(previews[0].contentMode).toBe("live");
    expect(previews[1].visible).toBe(true);
    expect(previews[1].contentMode).toBe("snapshot");
    expect(previews[1].excerpt.length).toBeLessThanOrEqual(47);
  });

  it("resolves previews back to mounted contexts", () => {
    const documents = buildAvailableDocuments([project]);
    const previews: ChatContextPreview[] = [
      {
        id: "document:sheet-1",
        type: "document",
        contentMode: "live",
        sheetId: "sheet-1",
        title: "正文",
        subtitle: "",
        excerpt: "正文",
        content: "旧正文快照不应被使用",
      },
      {
        id: "selection:sheet-1",
        type: "selection",
        contentMode: "snapshot",
        title: "选区",
        subtitle: "",
        excerpt: "选区摘要",
        content: "选区快照内容",
      },
    ];

    const contexts = resolveMountedContextsFromPreviews(previews, sheet, documents);

    expect(contexts.map((context) => context.type)).toEqual(["document", "selection"]);
    expect(contexts[0].content).toBe("正文内容");
    expect(contexts[1].content).toBe("选区快照内容");
  });

  it("normalizes live editor selection text for mounted selection context", () => {
    expect(normalizeSelectionContextText("  选区内容\n")).toBe("选区内容");
    expect(normalizeSelectionContextText("   \n\t")).toBe("");
  });

  it("infers content mode for legacy context previews", () => {
    const documentContext: ChatContextPreview = {
      id: "document:sheet-1",
      type: "document",
      sheetId: "sheet-1",
      title: "正文",
      subtitle: "当前文稿",
      excerpt: "正文",
    };
    const selectionContext: ChatContextPreview = {
      id: "selection:sheet-1",
      type: "selection",
      sheetId: "sheet-1",
      title: "选区",
      subtitle: "选区",
      excerpt: "选区内容",
    };

    expect(getChatContextContentMode(documentContext)).toBe("live");
    expect(getChatContextContentModeLabel(documentContext)).toBe("实时");
    expect(getChatContextContentModeDescription(documentContext)).toContain("当前本地文稿内容");
    expect(getChatContextContentMode(selectionContext)).toBe("snapshot");
    expect(getChatContextContentModeLabel(selectionContext)).toBe("快照");
    expect(getChatContextContentModeDescription(selectionContext)).toContain("发送时保存的选区文字");
  });

  it("builds accessible context chip labels and descriptions", () => {
    const documentContext: ChatContextPreview = {
      id: "document:sheet-1",
      type: "document",
      contentMode: "live",
      sheetId: "sheet-1",
      title: "正文",
      subtitle: "项目 / 第一组 / 正文",
      excerpt: "正文",
    };
    const selectionContext: ChatContextPreview = {
      id: "selection:sheet-1",
      type: "selection",
      contentMode: "snapshot",
      sheetId: "sheet-1",
      title: "选区",
      subtitle: "选区",
      excerpt: "选区摘录",
    };

    expect(getChatContextDisplayLabel(documentContext)).toBe("正文");
    expect(getChatContextDisplayDescription(documentContext)).toContain("文档：正文");
    expect(getChatContextDisplayDescription(documentContext)).toContain("来源：项目 / 第一组 / 正文");
    expect(getChatContextDisplayDescription(documentContext)).toContain("当前本地文稿内容");
    expect(getChatContextDisplayLabel(selectionContext)).toBe("选区摘录");
    expect(getChatContextDisplayDescription(selectionContext)).toContain("选区：选区摘录");
    expect(getChatContextDisplayDescription(selectionContext)).toContain("发送时保存的选区文字");
  });

  it("adds values only once", () => {
    expect(addUnique(["a"], "a")).toEqual(["a"]);
    expect(addUnique(["a"], "b")).toEqual(["a", "b"]);
  });
});
