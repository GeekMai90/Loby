import { describe, expect, it } from "vitest";
import { buildImageReferenceDocumentInsertion, buildMarkdownTextDocumentInsertion } from "@/features/editor/model/editorInsertions";

describe("editorInsertions", () => {
  it("inserts markdown text as a separated block", () => {
    expect(buildMarkdownTextDocumentInsertion("第一段", 3, 3, "第二段")?.body).toBe("第一段\n\n第二段\n\n");
  });

  it("replaces the selected range with a markdown block", () => {
    expect(buildMarkdownTextDocumentInsertion("开头\n\n旧段落\n\n结尾", 4, 7, "新段落")?.body).toBe("开头\n\n新段落\n\n结尾");
  });

  it("returns null for blank markdown insertions", () => {
    expect(buildMarkdownTextDocumentInsertion("正文", 2, 2, "   ")).toBeNull();
  });

  it("inserts image references with one blank line around the image block", () => {
    const insertion = buildImageReferenceDocumentInsertion("正文", 2, 2, [
      "![封面](../assets/images/cover.png)",
      "![[assets/images/detail.png]]",
    ]);

    expect(insertion?.body).toBe("正文\n\n![封面](../assets/images/cover.png)\n\n![[assets/images/detail.png]]\n\n");
  });

  it("merges existing surrounding blank lines when inserting image references", () => {
    const insertion = buildImageReferenceDocumentInsertion("正文\n\n\n结尾", 2, 2, ["![封面](../assets/images/cover.png)"]);

    expect(insertion?.body).toBe("正文\n\n![封面](../assets/images/cover.png)\n\n结尾");
  });
});
