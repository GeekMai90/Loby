// @vitest-environment happy-dom
/**
 * [INPUT]: 依赖 CodeMirror 6、Vitest 与 editorClipboard
 * [OUTPUT]: 验证编辑区选区文本、剪切事务与自定义粘贴事件/文本回退
 * [POS]: 编辑器右键菜单剪贴板动作的模型回归边界，保护普通文本与图片粘贴事件入口不被菜单替换破坏
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { EditorSelection, EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cutEditorSelection, hasEditorSelection, pasteEditorClipboard, selectedEditorText } from "@/features/editor/model/editorClipboard";

let view: EditorView | null = null;

afterEach(() => {
  view?.destroy();
  view = null;
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("editorClipboard", () => {
  it("reads selected text across multiple ranges with the document line break", () => {
    view = createView("first\nsecond\nthird");
    view.dispatch({
      selection: EditorSelection.create([EditorSelection.range(0, 2), EditorSelection.range(13, 15)]),
    });

    expect(hasEditorSelection(view)).toBe(true);
    expect(selectedEditorText(view)).toBe("fi\nth");
  });

  it("cuts the current selection through the clipboard fallback", async () => {
    view = createView("前文需要剪切后文");
    view.dispatch({ selection: { anchor: 2, head: 4 } });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    await expect(cutEditorSelection(view)).resolves.toBe(true);

    expect(writeText).toHaveBeenCalledWith("需要");
    expect(view.state.doc.toString()).toBe("前文剪切后文");
  });

  it("pastes text when the clipboard does not expose ClipboardItem.read", async () => {
    view = createView("前后");
    view.dispatch({ selection: { anchor: 1 } });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { readText: vi.fn().mockResolvedValue("插入内容") },
    });

    await expect(pasteEditorClipboard(view)).resolves.toBe(true);

    expect(view.state.doc.toString()).toBe("前插入内容后");
  });
});

function createView(doc: string): EditorView {
  const parent = document.createElement("div");
  document.body.append(parent);
  return new EditorView({
    parent,
    state: EditorState.create({
      doc,
      extensions: [EditorState.allowMultipleSelections.of(true)],
    }),
  });
}
