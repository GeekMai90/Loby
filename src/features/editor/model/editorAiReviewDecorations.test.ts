// @vitest-environment happy-dom
/**
 * [INPUT]: 依赖 CodeMirror 6、Vitest、AI 正文变更解析与 editorAiReviewDecorations
 * [OUTPUT]: 验证 AI 前后版本差异的新增、删除、结构变更与后续编辑锚点重定位
 * [POS]: 编辑器 feature 的 AI 审阅装饰回归边界，覆盖模型变更清单漂移时的真实可见行为
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */

import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { afterEach, describe, expect, it } from "vitest";
import type { AiChangeBlock } from "@/shared/types";
import { aiReviewDecorations } from "@/features/editor/model/editorAiReviewDecorations";
import { extractAiChangeSetFromMessage } from "@/features/assistant/model/aiChangeSets";

let view: EditorView | null = null;

afterEach(() => {
  view?.destroy();
  view = null;
  document.body.replaceChildren();
});

describe("editorAiReviewDecorations", () => {
  it("keeps paragraph splits and Markdown-only formatting changes visible", () => {
    const fromText = "第一句很长。第二句需要强调，第三句需要高亮。";
    const body = "第一句很长。\n\n第二句**需要强调**，第三句==需要高亮==。";
    const change: AiChangeBlock = {
      id: "structure-and-formatting",
      status: "accepted",
      fromText,
      toText: body,
      anchor: { from: 0, to: body.length },
    };
    const parent = document.createElement("div");
    document.body.append(parent);

    view = new EditorView({
      parent,
      state: EditorState.create({ doc: body, extensions: [aiReviewDecorations([change])] }),
    });

    const visibleFallback = parent.querySelectorAll(".cm-ai-structural-change");
    expect(visibleFallback.length).toBeGreaterThan(0);
    expect(Array.from(visibleFallback, (element) => element.textContent).join("")).toContain("第二句");
  });

  it("keeps ordinary wording changes granular", () => {
    const body = "这是一句更清楚的新表达。";
    const change: AiChangeBlock = {
      id: "wording",
      status: "accepted",
      fromText: "这是一句旧表达。",
      toText: body,
      anchor: { from: 0, to: body.length },
    };
    const parent = document.createElement("div");
    document.body.append(parent);

    view = new EditorView({
      parent,
      state: EditorState.create({ doc: body, extensions: [aiReviewDecorations([change])] }),
    });

    expect(parent.querySelector(".cm-ai-structural-change")).toBeNull();
    expect(parent.querySelector(".cm-ai-inserted")?.textContent).toContain("更清楚的新");
  });

  it("renders deletion-only changes at their resolved anchor", () => {
    const body = "第一节正文。\n\n## 第二节";
    const deletionPosition = body.indexOf("## 第二节");
    const change: AiChangeBlock = {
      id: "delete-outline",
      status: "accepted",
      fromText: "- 已完成的提纲一\n- 已完成的提纲二",
      toText: "",
      anchor: { from: deletionPosition, to: deletionPosition, startLine: 3, endLine: 4 },
    };
    const parent = document.createElement("div");
    document.body.append(parent);

    view = new EditorView({
      parent,
      state: EditorState.create({ doc: body, extensions: [aiReviewDecorations([change])] }),
    });

    expect(parent.querySelector(".cm-ai-deleted")?.textContent).toBe(change.fromText);
    expect(parent.querySelector(".cm-ai-deleted-block")).not.toBeNull();
  });

  it("shows the document diff when the model change list only describes the applied rewrite", () => {
    const baseBody = ["## 第一节", "", "- 提纲一", "- 提纲二", "", "## 第二节"].join("\n");
    const proposedBody = ["## 第一节", "", "第一段完整正文。", "", "第二段完整正文。", "", "## 第二节"].join("\n");
    const message = [
      "已完成扩写。",
      "```loby-change",
      JSON.stringify({
        proposedBody,
        changes: [{ fromText: "- 提纲一\n- 提纲二", toText: "将两条提纲扩写为两段完整正文。" }],
      }),
      "```",
    ].join("\n");
    const changeSet = extractAiChangeSetFromMessage(message, "sheet-1", baseBody).changeSet!;
    const parent = document.createElement("div");
    document.body.append(parent);

    view = new EditorView({
      parent,
      state: EditorState.create({ doc: proposedBody, extensions: [aiReviewDecorations(changeSet.changes)] }),
    });

    expect(parent.querySelectorAll(".cm-ai-inserted").length).toBeGreaterThan(0);
    expect(parent.querySelectorAll(".cm-ai-deleted").length).toBeGreaterThan(0);
    expect(Array.from(parent.querySelectorAll(".cm-ai-inserted"), (element) => element.textContent).join("")).toContain("完整正文");
    expect(Array.from(parent.querySelectorAll(".cm-ai-deleted"), (element) => element.textContent).join("")).toContain("提纲");
  });

  it("does not strike through whole Chinese paragraphs for light proofreading", () => {
    const baseBody = [
      "# 开发日记",
      "第一段功能开发的已经差不多了，足够满足需求了，这不并简单。",
      "",
      "第二段今天看到B站的视频，使用Flutter开发Markdown编辑器。",
      "",
      "第三段现在使用AI开发应用，原来得开着钱求开发者。",
    ].join("\n");
    const proposedBody = [
      "# 开发日记",
      "",
      "第一段功能已经开发得差不多了，足够满足需求，这并不简单。",
      "",
      "第二段今天看到 B 站的视频，使用 Flutter 开发 Markdown 编辑器。",
      "",
      "第三段现在使用 AI 开发应用，原来得花着钱求开发者。",
    ].join("\n");
    const message = `说明\n\`\`\`loby-change\n${JSON.stringify({ proposedBody })}\n\`\`\``;
    const changeSet = extractAiChangeSetFromMessage(message, "sheet-1", baseBody).changeSet!;
    const parent = document.createElement("div");
    document.body.append(parent);

    const bodyAfterLaterTitleEdit = proposedBody.replace("# 开发日记", "# 开发日记 - 后续补充标题");
    view = new EditorView({
      parent,
      state: EditorState.create({ doc: bodyAfterLaterTitleEdit, extensions: [aiReviewDecorations(changeSet.changes)] }),
    });

    const deletedText = Array.from(parent.querySelectorAll(".cm-ai-deleted"), (element) => element.textContent).join("");
    const insertedText = Array.from(parent.querySelectorAll(".cm-ai-inserted"), (element) => element.textContent).join("");

    expect(deletedText.length).toBeLessThan(baseBody.length / 3);
    expect(insertedText.length).toBeLessThan(proposedBody.length / 3);
    expect(deletedText).not.toContain("第二段今天看到B站的视频");
    expect(insertedText).not.toContain("第二段今天看到 B 站的视频");
    expect(insertedText).not.toContain("后续补充标题");
    expect(parent.querySelector(".cm-ai-deleted-block")).toBeNull();
    const titleEnd = bodyAfterLaterTitleEdit.indexOf("\n");
    expect(
      Array.from(parent.querySelectorAll(".cm-ai-inserted"), (element) => view!.posAtDOM(element)).every(
        (position) => position >= titleEnd,
      ),
    ).toBe(true);
  });
});
