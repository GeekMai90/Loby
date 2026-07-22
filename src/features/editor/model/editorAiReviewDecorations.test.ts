// @vitest-environment happy-dom

import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { afterEach, describe, expect, it } from "vitest";
import type { AiChangeBlock } from "@/shared/types";
import { aiReviewDecorations } from "@/features/editor/model/editorAiReviewDecorations";

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
});
