// @vitest-environment happy-dom
/**
 * [INPUT]: 依赖 CodeMirror 6、Vitest 与 editorImagePreview
 * [OUTPUT]: 验证图片预览选中后可通过键盘删除 Markdown 引用并通知资源清理
 * [POS]: 编辑器图片预览的交互回归边界，保护预览态删除与源码同步
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { afterEach, describe, expect, it, vi } from "vitest";
import { imagePreviewDecorations } from "@/features/editor/model/editorImagePreview";

let view: EditorView | null = null;

afterEach(() => {
  view?.destroy();
  view = null;
  document.body.replaceChildren();
});

describe("editorImagePreview", () => {
  it.each(["Backspace", "Delete"])("deletes a selected image reference with %s", (key) => {
    const onDeleteImage = vi.fn();
    const parent = document.createElement("div");
    document.body.append(parent);
    view = new EditorView({
      parent,
      state: EditorState.create({
        doc: "前文\n\n![测试图](assets/images/test.png)\n\n后文",
        extensions: [
          markdown(),
          imagePreviewDecorations(
            () => ({
              src: "asset://localhost/test.png",
              alt: "测试图",
              label: "test.png",
              sourcePath: "/library/assets/images/test.png",
            }),
            { onDeleteImage },
          ),
        ],
      }),
    });

    const image = parent.querySelector<HTMLImageElement>(".cm-image-preview img");
    expect(image).not.toBeNull();
    image!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(parent.querySelector(".cm-image-preview.selected")).not.toBeNull();

    view.contentDOM.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));

    expect(view.state.doc.toString()).toBe("前文\n\n\n后文");
    expect(parent.querySelector(".cm-image-preview")).toBeNull();
    expect(onDeleteImage).toHaveBeenCalledOnce();
    expect(onDeleteImage).toHaveBeenCalledWith("/library/assets/images/test.png");
  });

  it("clears the selected preview when the user clicks outside the image", () => {
    const parent = document.createElement("div");
    const outside = document.createElement("button");
    document.body.append(parent, outside);
    view = new EditorView({
      parent,
      state: EditorState.create({
        doc: "![测试图](assets/images/test.png)",
        extensions: [
          markdown(),
          imagePreviewDecorations(() => ({
            src: "asset://localhost/test.png",
            alt: "测试图",
            label: "test.png",
            sourcePath: "/library/assets/images/test.png",
          })),
        ],
      }),
    });

    parent.querySelector<HTMLImageElement>(".cm-image-preview img")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(parent.querySelector(".cm-image-preview.selected")).not.toBeNull();

    outside.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));

    expect(parent.querySelector(".cm-image-preview.selected")).toBeNull();
  });
});
