import { describe, expect, it } from "vitest";
import { buildEditorAiImageInsertion, buildEditorAiTextInsertion } from "@/features/assistant/model/aiActionInsertion";

describe("aiActionInsertion", () => {
  it("builds a text insertion from the current editor document", () => {
    const result = buildEditorAiTextInsertion({
      sheetBody: "第一段",
      editorBody: "第一段",
      selection: { from: 3, to: 3, head: 3 },
      target: "cursor",
      text: "第二段",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.range).toEqual({ from: 3, to: 3 });
    expect(result.insertion.body).toBe("第一段\n\n第二段\n\n");
  });

  it("rejects stale editor documents before calculating an AI insertion", () => {
    const result = buildEditorAiTextInsertion({
      sheetBody: "最新正文",
      editorBody: "过期正文",
      selection: { from: 4, to: 4, head: 4 },
      target: "cursor",
      text: "补充段落",
    });

    expect(result).toEqual({
      ok: false,
      message: "当前编辑器内容和文稿状态不同步，请稍后重试，避免 AI 写入过期内容。",
    });
  });

  it("requires a real selection when the AI action targets selection", () => {
    const result = buildEditorAiTextInsertion({
      sheetBody: "旧段落",
      editorBody: "旧段落",
      selection: { from: 3, to: 3, head: 3 },
      target: "selection",
      text: "新段落",
    });

    expect(result).toEqual({
      ok: false,
      message: "这个 AI 动作要求替换当前选区，请先选中文本后再执行。",
    });
  });

  it("builds image insertions with the same safety checks", () => {
    const result = buildEditorAiImageInsertion({
      sheetBody: "正文",
      editorBody: "正文",
      selection: { from: 2, to: 2, head: 2 },
      target: "end",
      reference: "![封面](../assets/images/cover.png)",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.range).toEqual({ from: 2, to: 2 });
    expect(result.insertion.body).toBe("正文\n\n![封面](../assets/images/cover.png)\n\n");
  });

  it("builds image insertions from paragraph anchors", () => {
    const body = "第一段。\n\n第二段。\n\n第三段。\n\n第四段。";
    const result = buildEditorAiImageInsertion({
      sheetBody: body,
      editorBody: body,
      selection: { from: 0, to: 0, head: 0 },
      target: "anchor",
      anchor: { type: "paragraphFromEnd", index: 3, position: "after" },
      reference: "![封面](../assets/images/cover.png)",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.insertion.body).toBe("第一段。\n\n第二段。\n\n![封面](../assets/images/cover.png)\n\n第三段。\n\n第四段。");
  });
});
