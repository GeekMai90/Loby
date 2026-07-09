import { describe, expect, it } from "vitest";
import { buildAiActionPreview } from "./aiActionPreview";
import type { AiAction } from "../types";

describe("aiActionPreview", () => {
  it("summarizes create sheet content before execution", () => {
    const preview = buildAiActionPreview(
      action("createSheet", { title: "案例素材", sheetType: "素材", body: "第一段\n\n第二段" }, { targetProjectTitle: "写作项目" }),
    );

    expect(preview.fields).toContainEqual(["项目", "写作项目"]);
    expect(preview.fields).toContainEqual(["标题", "案例素材"]);
    expect(preview.fields).toContainEqual(["正文", "6 字"]);
    expect(preview.excerpt).toBe("第一段 第二段");
  });

  it("previews the actual image reference syntax", () => {
    const preview = buildAiActionPreview(
      action("insertImage", {
        path: "assets/images/cover.png",
        alt: "封面",
        format: "obsidian",
        target: "anchor",
        anchor: { type: "paragraphFromEnd", index: 3, position: "after" },
      }),
    );

    expect(preview.fields).toContainEqual(["位置", "倒数第 3 段之后"]);
    expect(preview.excerpt).toBe("![[assets/images/cover.png|封面]]");
  });

  it("summarizes text insertion proposals", () => {
    const preview = buildAiActionPreview(
      action("insertText", { title: "过渡句", text: "第一句。\n\n第二句。", target: "selection" }, { targetSheetTitle: "第一篇" }),
    );

    expect(preview.fields).toContainEqual(["目标文稿", "第一篇"]);
    expect(preview.fields).toContainEqual(["位置", "当前选区（执行时必须仍有选区）"]);
    expect(preview.fields).toContainEqual(["标题", "过渡句"]);
    expect(preview.fields).toContainEqual(["文本", "6 字"]);
    expect(preview.excerpt).toBe("第一句。 第二句。");
  });
});

function action(type: AiAction["type"], payload: AiAction["payload"], overrides: Partial<AiAction> = {}): AiAction {
  return {
    id: "action-1",
    type,
    status: "proposed",
    title: "动作",
    summary: "摘要",
    payload,
    createdAt: "2026-07-09T10:00:00+08:00",
    ...overrides,
  };
}
