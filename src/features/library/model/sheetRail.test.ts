/**
 * [INPUT]: 依赖 Vitest、shared 文稿模型与写作库文稿列表投影
 * [OUTPUT]: 验证标题、摘要、首图、Bear 式时间/项目元信息与空文稿判断
 * [POS]: library/model 的文稿卡片投影回归测试，保护高频预览清洗和有界读取
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { describe, expect, it } from "vitest";
import type { WritingSheet } from "@/shared/types";
import {
  getSheetDisplayTitle,
  getSheetMetaText,
  getSheetPreview,
  getSheetPreviewImage,
  isBlankSheet,
} from "@/features/library/model/sheetRail";

function sheet(overrides: Partial<WritingSheet> = {}): WritingSheet {
  return {
    id: "sheet-1",
    title: "原标题",
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
          "![封面](<../assets/images/cover (final).png>)",
          "> **重点**：这里有 `代码`、~下划线~、==高亮== 和脚注[^1]，::冒号内容:: 保持原样",
          "- [ ] 待办事项",
          "包含 ![插图](image.png) 的段落",
        ].join("\n"),
      }),
    );

    expect(preview).toBe("重点：这里有 代码、下划线、高亮 和脚注1，::冒号内容:: 保持原样 待办事项 包含 插图 的段落");
  });

  it("uses the first markdown or Obsidian image as the card thumbnail", () => {
    expect(getSheetPreviewImage(sheet({ body: "正文\n![第一张](assets/one.png)\n![[assets/two.png|第二张]]" }))).toMatchObject({
      path: "assets/one.png",
      alt: "第一张",
    });
  });

  it("reads a long body a bounded number of times while building the preview", () => {
    const model = sheet();
    const body = ["# 正文标题", "", ...Array.from({ length: 2_000 }, (_, index) => `第 ${index + 1} 段正文`)].join("\n");
    let bodyReads = 0;
    Object.defineProperty(model, "body", {
      get() {
        bodyReads += 1;
        return body;
      },
    });

    expect(getSheetPreview(model)).toBe("第 1 段正文 第 2 段正文 第 3 段正文");
    expect(bodyReads).toBe(1);
  });

  it("detects a new untitled sheet without treating authored titles as blank", () => {
    expect(isBlankSheet(sheet({ title: "无标题", body: "  ", description: "" }))).toBe(true);
    expect(isBlankSheet(sheet({ title: "已有标题", body: "", description: "" }))).toBe(false);
    expect(isBlankSheet(sheet({ title: "无标题", body: "", description: "摘要" }))).toBe(false);
  });

  it("shows recent updates in minutes, then falls back to a month-day label with project", () => {
    const now = new Date(2026, 6, 31, 10, 30, 0);
    expect(getSheetMetaText(sheet({ updatedAt: new Date(2026, 6, 31, 10, 29, 45).toISOString() }), "麦先生说", now)).toBe(
      "刚刚 · 麦先生说",
    );
    expect(getSheetMetaText(sheet({ updatedAt: new Date(2026, 6, 31, 10, 27, 0).toISOString() }), "麦先生说", now)).toBe(
      "3分钟前 · 麦先生说",
    );
    expect(getSheetMetaText(sheet({ updatedAt: new Date(2026, 6, 30, 9, 0, 0).toISOString() }), "麦先生说", now)).toBe(
      "7月30日 · 麦先生说",
    );
  });
});
