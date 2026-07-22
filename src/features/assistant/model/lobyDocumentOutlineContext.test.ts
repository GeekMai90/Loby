import { describe, expect, it } from "vitest";
import type { WritingSheet } from "@/shared/types";
import { buildLobyDocumentOutlineContext } from "@/features/assistant/model/lobyDocumentOutlineContext";

describe("lobyDocumentOutlineContext", () => {
  it("summarizes document shape without embedding the full body", () => {
    const context = buildLobyDocumentOutlineContext(
      sheet({
        body: ["# 开头", "", "第一段。", "", "## 案例", "", "第二段。", "", "### 小结", "", "第三段。"].join("\n"),
      }),
      "选中的句子",
    );

    expect(context).toContain("### 当前文稿轮廓");
    expect(context).toContain("6 段，3 个标题");
    expect(context).toContain("当前选区：5 字");
    expect(context).toContain("- H1 L1: 开头");
    expect(context).toContain("  - H2 L5: 案例");
    expect(context).toContain("    - H3 L9: 小结");
    expect(context).toContain("正文段落锚点");
    expect(context).toContain("- 第 1 段 / 倒数第 3 段：第一段。");
    expect(context).toContain("- 第 3 段 / 倒数第 1 段：第三段。");
    expect(context).toContain("没有全文时，只能做结构级判断");
  });

  it("caps long heading lists", () => {
    const body = Array.from({ length: 5 }, (_, index) => `## 标题 ${index + 1}`).join("\n\n");
    const context = buildLobyDocumentOutlineContext(sheet({ body }), "", { maxHeadings: 3 });

    expect(context).toContain("当前选区：无");
    expect(context).toContain("标题 1");
    expect(context).toContain("标题 3");
    expect(context).not.toContain("标题 4");
    expect(context).toContain("- 另有 2 个标题未列出");
  });

  it("handles documents without markdown headings", () => {
    const context = buildLobyDocumentOutlineContext(sheet({ body: "只有正文\n\n第二段" }), "");

    expect(context).toContain("- 当前文稿还没有 Markdown 标题。");
  });

  it("caps long paragraph anchor lists", () => {
    const body = Array.from({ length: 5 }, (_, index) => `第 ${index + 1} 段正文。`).join("\n\n");
    const context = buildLobyDocumentOutlineContext(sheet({ body }), "", { maxParagraphAnchors: 3 });

    expect(context).toContain("第 1 段正文。");
    expect(context).toContain("第 3 段正文。");
    expect(context).not.toContain("第 4 段正文。");
    expect(context).toContain("- 另有 2 个正文段落未列出");
  });
});

function sheet(overrides: Partial<WritingSheet>): WritingSheet {
  return {
    id: "sheet-1",
    title: "文稿",
    groupId: "group-main",
    status: "构思",
    targetWords: 1000,
    summary: "",
    body: "",
    updatedAt: "2026-07-09",
    ...overrides,
  };
}
