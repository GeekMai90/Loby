import { describe, expect, it } from "vitest";
import { validateAiActionPayload } from "./aiActionValidation";
import type { AiAction } from "../types";

describe("aiActionValidation", () => {
  it("accepts complete text, image, export, and sheet actions", () => {
    expect(validateAiActionPayload(action("insertText", { text: "正文", target: "cursor" })).issues).toEqual([]);
    expect(validateAiActionPayload(action("insertImage", { path: "../assets/images/cover.png", target: "end" })).issues).toEqual([]);
    expect(validateAiActionPayload(action("insertImage", { path: "assets/images/cover.png" })).issues).toEqual([]);
    expect(validateAiActionPayload(action("insertImage", { path: "cover.webp" })).issues).toEqual([]);
    expect(
      validateAiActionPayload(
        action("insertImage", {
          path: "cover.webp",
          target: "anchor",
          anchor: { type: "paragraphFromEnd", index: 3, position: "after" },
        }),
      ).issues,
    ).toEqual([]);
    expect(validateAiActionPayload(action("insertImage", { path: "https://example.com/cover.png" })).issues).toEqual([]);
    expect(validateAiActionPayload(action("saveExport", { content: "# Draft" })).issues).toEqual([]);
    expect(validateAiActionPayload(action("saveExport", { filename: "draft.md", content: "# Draft" })).issues).toEqual([]);
    expect(validateAiActionPayload(action("createSheet", { title: "素材卡" })).issues).toEqual([]);
    expect(validateAiActionPayload({ ...action("createSheet", {}), title: "创建文稿：素材卡" }).issues).toEqual([]);
  });

  it("reports missing required payload fields before execution", () => {
    expect(validateAiActionPayload(action("insertText", {})).issues).toEqual(["缺少要插入的文本，请让 AI 补充 text。"]);
    expect(validateAiActionPayload(action("insertImage", {})).issues).toEqual(["缺少图片路径，请让 AI 补充 path。"]);
    expect(validateAiActionPayload(action("saveExport", {})).issues).toEqual(["缺少导出内容，请让 AI 补充 content。"]);
    expect(validateAiActionPayload(action("createSheet", {})).issues).toEqual(["缺少新文稿标题，请让 AI 补充 title。"]);
  });

  it("rejects unsupported insertion targets", () => {
    expect(validateAiActionPayload(action("insertText", { text: "正文", target: "beginning" })).issues).toEqual([
      "插入位置 target 只允许 cursor、selection、end 或 anchor。",
    ]);
    expect(validateAiActionPayload(action("insertImage", { path: "cover.webp", target: "beginning" })).issues).toEqual([
      "插入位置 target 只允许 cursor、selection、end 或 anchor。",
    ]);
    expect(validateAiActionPayload(action("insertImage", { path: "cover.webp", target: "anchor" })).issues).toEqual([
      "锚点定位需要提供 anchor 对象。",
    ]);
  });

  it("rejects unsafe image paths and export filenames", () => {
    expect(validateAiActionPayload(action("insertImage", { path: "/Users/example/secret.png" })).issues).toEqual([
      "图片路径不能是系统绝对路径。",
    ]);
    expect(validateAiActionPayload(action("insertImage", { path: "file:///Users/example/secret.png" })).issues).toEqual([
      "图片路径只允许项目相对路径或 http/https 图片链接。",
    ]);
    expect(validateAiActionPayload(action("insertImage", { path: "../../secret.png" })).issues).toEqual([
      "图片路径必须指向项目 assets 目录、当前目录图片文件，或 http/https 图片链接。",
    ]);
    expect(validateAiActionPayload(action("insertImage", { path: "..\\assets\\cover.png" })).issues).toEqual([
      "图片路径请使用正斜杠 /，不要使用反斜杠。",
    ]);
    expect(validateAiActionPayload(action("saveExport", { filename: "../draft.md", content: "# Draft" })).issues).toEqual([
      "导出文件名不能包含路径，只能是文件名。",
    ]);
    expect(validateAiActionPayload(action("saveExport", { filename: "drafts/final.md", content: "# Draft" })).issues).toEqual([
      "导出文件名不能包含路径，只能是文件名。",
    ]);
  });
});

function action(type: AiAction["type"], payload: AiAction["payload"]): AiAction {
  return {
    id: "action-1",
    type,
    status: "proposed",
    title: "动作",
    summary: "摘要",
    payload,
    createdAt: "2026-07-09T10:00:00+08:00",
  };
}
