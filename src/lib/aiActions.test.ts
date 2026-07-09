import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { extractAiActionsFromMessage, stripAiActionBlocks } from "./aiActions";

describe("aiActions", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-09T10:00:00+08:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("extracts a generic nibva action block", () => {
    const message = [
      "我建议先创建一张素材卡。",
      "```nibva-action",
      JSON.stringify({
        action: "createSheet",
        title: "创建文稿：案例素材",
        summary: "把案例单独沉淀为素材卡。",
        payload: {
          title: "案例素材",
          sheetType: "素材",
          body: "# 案例素材\n\n",
        },
      }),
      "```",
    ].join("\n");

    const result = extractAiActionsFromMessage(message);

    expect(result.content).toBe("我建议先创建一张素材卡。");
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]).toMatchObject({
      type: "createSheet",
      status: "proposed",
      title: "创建文稿：案例素材",
      summary: "把案例单独沉淀为素材卡。",
      payload: {
        title: "案例素材",
        sheetType: "素材",
      },
    });
  });

  it("extracts specialized action blocks and action arrays", () => {
    const message = [
      "```nibva-insert-image",
      JSON.stringify({ path: "../assets/images/cover.png", alt: "封面", format: "markdown" }),
      "```",
      "```nibva-insert-text",
      JSON.stringify({ title: "过渡句", text: "这也解释了为什么我们需要重新定义工具。", target: "selection" }),
      "```",
      "```nibva-actions",
      JSON.stringify([
        { action: "saveExport", filename: "draft.md", format: "markdown" },
        { action: "unsupported", title: "忽略" },
      ]),
      "```",
    ].join("\n");

    const result = extractAiActionsFromMessage(message);

    expect(result.content).toBe("");
    expect(result.actions.map((action) => action.type)).toEqual(["insertImage", "insertText", "saveExport"]);
    expect(result.actions[0].title).toBe("插入图片：封面");
    expect(result.actions[0].payload).toMatchObject({ path: "../assets/images/cover.png", alt: "封面", format: "markdown" });
    expect(result.actions[1].title).toBe("过渡句");
    expect(result.actions[1].payload).toMatchObject({
      title: "过渡句",
      text: "这也解释了为什么我们需要重新定义工具。",
      target: "selection",
    });
    expect(result.actions[2].title).toBe("保存导出：draft.md");
    expect(result.actions[2].payload).toMatchObject({ filename: "draft.md", format: "markdown" });
  });

  it("attaches app-owned target context to extracted sheet actions", () => {
    const result = extractAiActionsFromMessage('```nibva-insert-text\n{"text":"补一句"}\n```', {
      projectId: "project-1",
      projectTitle: "写作项目",
      sheetId: "sheet-1",
      sheetTitle: "第一篇",
    });

    expect(result.actions[0]).toMatchObject({
      targetProjectId: "project-1",
      targetProjectTitle: "写作项目",
      targetSheetId: "sheet-1",
      targetSheetTitle: "第一篇",
    });
  });

  it("does not attach sheet targets to project-level actions", () => {
    const result = extractAiActionsFromMessage('```nibva-save-export\n{"filename":"draft.md","content":"正文"}\n```', {
      projectId: "project-1",
      projectTitle: "写作项目",
      sheetId: "sheet-1",
      sheetTitle: "第一篇",
    });

    expect(result.actions[0]).toMatchObject({
      targetProjectId: "project-1",
      targetProjectTitle: "写作项目",
    });
    expect(result.actions[0].targetSheetId).toBeUndefined();
    expect(result.actions[0].targetSheetTitle).toBeUndefined();
  });

  it("ignores malformed blocks and hides incomplete streamed blocks", () => {
    expect(extractAiActionsFromMessage("```nibva-action\nnot-json\n```").actions).toEqual([]);
    expect(stripAiActionBlocks('说明\n```nibva-action\n{"action"')).toBe("说明");
  });
});
