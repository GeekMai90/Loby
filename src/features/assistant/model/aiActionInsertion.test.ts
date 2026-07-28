/**
 * [INPUT]: 依赖 Vitest 与 aiActionInsertion 的纯文稿写入规划
 * [OUTPUT]: 验证文本、单图和多图锚点规划、过期正文拒绝与批量失败原子性
 * [POS]: assistant/model 的 AI 写入规划回归测试，不触碰真实编辑器或持久化
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { describe, expect, it } from "vitest";
import {
  buildEditorAiImageBatchInsertion,
  buildEditorAiImageInsertion,
  buildEditorAiTextInsertion,
} from "@/features/assistant/model/aiActionInsertion";

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

  it("plans multiple anchored images into one final document body", () => {
    const body = "开头段落。\n\n## 第二部分\n\n结尾段落。";
    const result = buildEditorAiImageBatchInsertion({
      sheetBody: body,
      editorBody: body,
      selection: { from: 0, to: 0, head: 0 },
      items: [
        {
          target: "anchor",
          anchor: { type: "afterText", text: "开头段落。", position: "after" },
          reference: "![第一张](assets/images/one.png)",
        },
        {
          target: "anchor",
          anchor: { type: "afterHeading", heading: "第二部分", position: "after" },
          reference: "![第二张](assets/images/two.png)",
        },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.insertion.body).toBe(
      "开头段落。\n\n![第一张](assets/images/one.png)\n\n## 第二部分\n\n![第二张](assets/images/two.png)\n\n结尾段落。",
    );
  });

  it("rejects the entire image batch when any anchor is invalid", () => {
    const body = "正文。";
    const result = buildEditorAiImageBatchInsertion({
      sheetBody: body,
      editorBody: body,
      selection: { from: 0, to: 0, head: 0 },
      items: [
        { target: "end", reference: "![第一张](assets/images/one.png)" },
        {
          target: "anchor",
          anchor: { type: "afterHeading", heading: "不存在", position: "after" },
          reference: "![第二张](assets/images/two.png)",
        },
      ],
    });

    expect(result).toEqual({ ok: false, message: "无法找到标题「不存在」。" });
  });
});
