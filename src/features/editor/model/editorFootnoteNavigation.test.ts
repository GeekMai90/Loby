// @vitest-environment happy-dom
/**
 * [INPUT]: 依赖 CodeMirror 6、Vitest、Loby Markdown 扩展、脚注装饰与导航扩展
 * [OUTPUT]: 验证脚注定义不会冒充链接，保护正文引用与定义之间的双向跳转，并让孤立定义标签进入源码
 * [POS]: 编辑器脚注交互的回归边界，覆盖阅读态样式语义、光标导航与无引用定义的编辑入口
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { afterEach, describe, expect, it } from "vitest";
import {
  createEditorFootnoteNavigationExtension,
  findFootnoteDefinition,
  findFootnoteReference,
} from "@/features/editor/model/editorFootnoteNavigation";
import { lobyMarkdownExtensions } from "@/features/editor/model/editorMarkdownLanguage";
import { collectMarkdownSyntaxConstructs, markdownSyntaxDecorations } from "@/features/editor/model/editorMarkdownDecorations";

let view: EditorView | null = null;

afterEach(() => {
  view?.destroy();
  view = null;
  document.body.replaceChildren();
});

function createState(doc: string) {
  return EditorState.create({
    doc,
    extensions: [markdown({ extensions: lobyMarkdownExtensions })],
  });
}

describe("editorFootnoteNavigation", () => {
  it("separates a footnote definition from the inline reference construct", () => {
    const doc = "正文[^note]\n\n[^note]: 一条脚注";
    const state = createState(doc);
    const constructs = collectMarkdownSyntaxConstructs(state);

    expect(constructs.filter((construct) => construct.kind === "FootnoteReference")).toHaveLength(1);
    expect(constructs.filter((construct) => construct.kind === "FootnoteDefinition")).toHaveLength(1);
    expect(findFootnoteReference(state, "note")?.contentFrom).toBe(doc.indexOf("note"));
    expect(findFootnoteDefinition(state, "note")?.contentFrom).toBe(doc.indexOf("一条脚注"));
  });

  it("renders a muted definition block instead of a blue link sentence", () => {
    const parent = document.createElement("div");
    document.body.append(parent);
    view = new EditorView({
      parent,
      state: EditorState.create({
        doc: "正文[^note]\n\n[^note]: 一条脚注",
        extensions: [markdown({ extensions: lobyMarkdownExtensions }), markdownSyntaxDecorations],
      }),
    });

    expect(parent.querySelector(".cm-footnote-definition-first")).not.toBeNull();
    expect(parent.querySelector(".cm-footnote-definition-label")?.textContent).toBe("note");
    expect(parent.querySelector(".cm-footnote-definition-content")?.textContent).toBe("一条脚注");
    expect(parent.querySelectorAll(".cm-footnote-reference-rendered")).toHaveLength(1);
  });

  it("jumps from the inline reference to its definition and back", () => {
    const doc = "正文[^note]\n\n[^note]: 一条脚注";
    const parent = document.createElement("div");
    document.body.append(parent);
    view = new EditorView({
      parent,
      state: EditorState.create({
        doc,
        extensions: [
          markdown({ extensions: lobyMarkdownExtensions }),
          markdownSyntaxDecorations,
          createEditorFootnoteNavigationExtension(),
        ],
      }),
    });

    parent
      .querySelector<HTMLElement>(".cm-footnote-reference-rendered")!
      .dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0, cancelable: true }));
    expect(view.state.selection.main.head).toBe(doc.indexOf("一条脚注"));

    view.contentDOM.blur();
    const definitionLabel = parent.querySelector<HTMLElement>(".cm-footnote-definition-label");
    expect(definitionLabel).not.toBeNull();
    definitionLabel!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0, cancelable: true }));
    expect(view.state.selection.main.head).toBe(doc.indexOf("note"));
  });

  it("reveals an orphan footnote definition when its label has no reference to return to", () => {
    const doc = "[^note]: 一条孤立脚注";
    const parent = document.createElement("div");
    document.body.append(parent);
    view = new EditorView({
      parent,
      state: EditorState.create({
        doc,
        extensions: [
          markdown({ extensions: lobyMarkdownExtensions }),
          markdownSyntaxDecorations,
          createEditorFootnoteNavigationExtension(),
        ],
      }),
    });

    const definitionLabel = parent.querySelector<HTMLElement>(".cm-footnote-definition-label");
    expect(definitionLabel).not.toBeNull();
    definitionLabel!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0, cancelable: true }));

    expect(view.hasFocus).toBe(true);
    expect(view.state.selection.main.head).toBe(0);
    expect(parent.querySelector(".cm-footnote-definition-label")).toBeNull();
    expect(parent.querySelector(".cm-line")?.textContent).toBe(doc);
  });
});
