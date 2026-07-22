import { describe, expect, it } from "vitest";
import {
  normalizeAiInsertionTarget,
  resolveEditorInsertionRange,
  validateFallbackInsertionTarget,
} from "@/features/assistant/model/aiInsertionTarget";

describe("aiInsertionTarget", () => {
  it("normalizes supported insertion targets", () => {
    expect(normalizeAiInsertionTarget("cursor")).toBe("cursor");
    expect(normalizeAiInsertionTarget(" selection ")).toBe("selection");
    expect(normalizeAiInsertionTarget("end")).toBe("end");
    expect(normalizeAiInsertionTarget("anchor")).toBe("anchor");
    expect(normalizeAiInsertionTarget("beginning")).toBe("cursor");
    expect(normalizeAiInsertionTarget(null)).toBe("cursor");
  });

  it("resolves end and cursor ranges", () => {
    expect(resolveEditorInsertionRange("end", "一二三", { from: 2, to: 5 })).toEqual({ ok: true, range: { from: 3, to: 3 } });
    expect(resolveEditorInsertionRange("cursor", "一二三", { from: 2, to: 5, head: 5 })).toEqual({ ok: true, range: { from: 5, to: 5 } });
    expect(resolveEditorInsertionRange("cursor", "一二三", { from: 2, to: 5 })).toEqual({ ok: true, range: { from: 5, to: 5 } });
  });

  it("requires a non-empty selection for selection-targeted actions", () => {
    expect(resolveEditorInsertionRange("selection", "正文", { from: 4, to: 4 })).toEqual({
      ok: false,
      message: "这个 AI 动作要求替换当前选区，请先选中文本后再执行。",
    });
    expect(resolveEditorInsertionRange("selection", "正文", { from: 2, to: 5 })).toEqual({ ok: true, range: { from: 2, to: 5 } });
  });

  it("resolves paragraph anchors from the start or end of the document", () => {
    const body = ["# 标题", "第一段。", "第二段。", "![图](cover.png)", "第三段。", "第四段。"].join("\n\n");

    expect(
      resolveEditorInsertionRange("anchor", body, { from: 0, to: 0 }, { type: "paragraphFromEnd", index: 3, position: "after" }),
    ).toEqual({
      ok: true,
      range: { from: body.indexOf("第二段。") + "第二段。".length, to: body.indexOf("第二段。") + "第二段。".length },
    });
    expect(
      resolveEditorInsertionRange("anchor", body, { from: 0, to: 0 }, { type: "paragraphFromStart", index: 2, position: "before" }),
    ).toEqual({ ok: true, range: { from: body.indexOf("第二段。"), to: body.indexOf("第二段。") } });
  });

  it("counts visible body paragraphs without treating headings or images as paragraphs", () => {
    const body = [
      "# 为什么中国鬼怪故事里，没有 Demon?",
      "![封面](../assets/images/cover.png)",
      "看恐怖电影是我放松解压的一种方式。",
      "西方恐怖片看多了，我发现一个现象：除了我们熟知的 Ghost 之外，还存在着 Demon。",
      "Ghost 就是我们熟悉的“鬼魂”，通常指人死之后仍然滞留在人间的存在。",
      "但 Demon 不一样。它通常不是死去的人，而是一种更接近“邪恶灵体”的存在。",
    ].join("\n\n");

    expect(
      resolveEditorInsertionRange("anchor", body, { from: 0, to: 0 }, { type: "paragraphFromStart", index: 3, position: "after" }),
    ).toEqual({
      ok: true,
      range: {
        from: body.indexOf("Ghost 就是我们熟悉的") + "Ghost 就是我们熟悉的“鬼魂”，通常指人死之后仍然滞留在人间的存在。".length,
        to: body.indexOf("Ghost 就是我们熟悉的") + "Ghost 就是我们熟悉的“鬼魂”，通常指人死之后仍然滞留在人间的存在。".length,
      },
    });
  });

  it("uses a unique paragraph text excerpt to correct a mismatched paragraph index", () => {
    const body = "第一段。\n\n第二段。\n\n第三段有独特锚点。\n\n第四段。";

    expect(
      resolveEditorInsertionRange(
        "anchor",
        body,
        { from: 0, to: 0 },
        { type: "paragraphFromStart", index: 4, position: "after", text: "第三段有独特锚点" },
      ),
    ).toEqual({
      ok: true,
      range: {
        from: body.indexOf("第三段有独特锚点。") + "第三段有独特锚点。".length,
        to: body.indexOf("第三段有独特锚点。") + "第三段有独特锚点。".length,
      },
    });
  });

  it("resolves heading and text anchors", () => {
    const body = "# 开头\n\n第一段。\n\n## 小节\n\n第二段。";
    expect(resolveEditorInsertionRange("anchor", body, { from: 0, to: 0 }, { type: "afterHeading", heading: "小节" })).toEqual({
      ok: true,
      range: { from: body.indexOf("## 小节") + "## 小节".length, to: body.indexOf("## 小节") + "## 小节".length },
    });
    expect(resolveEditorInsertionRange("anchor", body, { from: 0, to: 0 }, { type: "afterText", text: "第一段。" })).toEqual({
      ok: true,
      range: { from: body.indexOf("第一段。") + "第一段。".length, to: body.indexOf("第一段。") + "第一段。".length },
    });
  });

  it("blocks selection-targeted fallback insertion when editor selection is unavailable", () => {
    expect(validateFallbackInsertionTarget("selection")).toEqual({
      ok: false,
      message: "这个 AI 动作要求替换当前选区，但当前编辑器没有可用选区。",
    });
    expect(validateFallbackInsertionTarget("cursor").ok).toBe(true);
    expect(validateFallbackInsertionTarget("end").ok).toBe(true);
  });
});
