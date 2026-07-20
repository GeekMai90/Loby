// @vitest-environment happy-dom

import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { afterEach, describe, expect, it } from "vitest";
import type { AiChangeBlock } from "../types";
import { aiReviewDecorations } from "./editorAiReviewDecorations";

let view: EditorView | null = null;

afterEach(() => {
  view?.destroy();
  view = null;
  document.body.replaceChildren();
});

describe("editorAiReviewDecorations", () => {
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
