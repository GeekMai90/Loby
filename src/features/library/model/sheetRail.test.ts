import { describe, expect, it } from "vitest";
import type { WritingSheet } from "@/shared/types";
import { getSheetDisplayTitle, getSheetPreview, isBlankSheet } from "@/features/library/model/sheetRail";

function sheet(overrides: Partial<WritingSheet> = {}): WritingSheet {
  return {
    id: "sheet-1",
    title: "原标题",
    status: "初稿",
    tags: [],
    targetWords: 0,
    description: "",
    body: "",
    createdAt: "2026-07-09T10:00:00.000Z",
    updatedAt: "2026-07-09T10:00:00.000Z",
    properties: {},
    ...overrides,
  };
}

describe("sheetRail", () => {
  it("prefers the first markdown H1 as the display title", () => {
    expect(getSheetDisplayTitle(sheet({ title: "列表标题", body: "# 正文标题\n\n内容" }))).toBe("正文标题");
  });

  it("builds a clean preview from markdown body text", () => {
    const preview = getSheetPreview(
      sheet({
        body: [
          "# 正文标题",
          "![封面](../assets/images/cover.png)",
          "> **重点**：这里有 `代码`、~下划线~、==高亮== 和脚注[^1]，::冒号内容:: 保持原样",
          "- [ ] 待办事项",
          "包含 ![插图](image.png) 的段落",
        ].join("\n"),
      }),
    );

    expect(preview).toBe("重点：这里有 代码、下划线、高亮 和脚注1，::冒号内容:: 保持原样 待办事项 包含 插图 的段落");
  });

  it("detects blank sheets by body and summary", () => {
    expect(isBlankSheet(sheet({ body: "  ", description: "" }))).toBe(true);
    expect(isBlankSheet(sheet({ body: "", description: "摘要" }))).toBe(false);
  });
});
