// @vitest-environment happy-dom
/**
 * [INPUT]: 依赖 CodeMirror 6、Vitest 与 editorCoreExtensions
 * [OUTPUT]: 验证应用级快捷键不会被编辑器默认 keymap 抢占
 * [POS]: 编辑器核心扩展的键盘边界回归，保护 CodeMirror 与应用级命令的所有权分离
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { afterEach, describe, expect, it } from "vitest";
import { createEditorCoreExtensions } from "@/features/editor/model/editorCoreExtensions";

let view: EditorView | null = null;

afterEach(() => {
  view?.destroy();
  view = null;
  document.body.replaceChildren();
});

describe("editorCoreExtensions", () => {
  it("leaves Command or Control slash to the application shortcut handler", () => {
    const parent = document.createElement("div");
    document.body.append(parent);
    view = new EditorView({
      parent,
      state: EditorState.create({
        doc: "正文",
        extensions: createEditorCoreExtensions(),
      }),
    });

    const commandEvent = new KeyboardEvent("keydown", {
      key: "/",
      code: "Slash",
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });
    const controlEvent = new KeyboardEvent("keydown", {
      key: "/",
      code: "Slash",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });

    view.contentDOM.dispatchEvent(commandEvent);
    view.contentDOM.dispatchEvent(controlEvent);

    expect(view.state.doc.toString()).toBe("正文");
    expect(commandEvent.defaultPrevented).toBe(false);
    expect(controlEvent.defaultPrevented).toBe(false);
  });
});
