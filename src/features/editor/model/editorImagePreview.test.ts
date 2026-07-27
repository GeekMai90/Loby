// @vitest-environment happy-dom
/**
 * [INPUT]: 依赖 CodeMirror 6、Vitest 与 editorImagePreview
 * [OUTPUT]: 验证本地、远程与失效图片预览，以及键盘删除 Markdown 引用和资源清理通知
 * [POS]: 编辑器图片预览的交互回归边界，保护异步加载、失败占位、源码恢复与删除同步
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

  it("loads a remote image through the asynchronous safe preview resolver", async () => {
    const parent = document.createElement("div");
    document.body.append(parent);
    const loadSrc = vi.fn().mockResolvedValue("asset://localhost/loby-image-previews/remote.png");
    view = new EditorView({
      parent,
      state: EditorState.create({
        doc: "![远程图](https://example.com/remote.png)",
        extensions: [
          markdown(),
          imagePreviewDecorations(() => ({
            src: "",
            loadSrc,
            alt: "远程图",
            label: "https://example.com/remote.png",
            sourcePath: "https://example.com/remote.png",
          })),
        ],
      }),
    });

    expect(parent.querySelector(".cm-image-preview-loading")?.textContent).toBe("正在加载图片…");
    await Promise.resolve();
    await Promise.resolve();

    expect(loadSrc).toHaveBeenCalledOnce();
    expect(parent.querySelector<HTMLImageElement>(".cm-image-preview img")?.src).toContain("remote.png");
    expect(parent.querySelector(".cm-image-preview-loading")).toBeNull();
  });

  it("keeps a failed image selectable, reveals its Markdown source, and deletes it with the keyboard", () => {
    const onDeleteImage = vi.fn();
    const parent = document.createElement("div");
    document.body.append(parent);
    const source = "![失效图片](不存在的图片.png)";
    view = new EditorView({
      parent,
      state: EditorState.create({
        doc: `前文\n${source}\n后文`,
        extensions: [
          markdown(),
          imagePreviewDecorations(
            () => ({
              src: "asset://localhost/missing.png",
              alt: "失效图片",
              label: "不存在的图片.png",
              sourcePath: "/library/不存在的图片.png",
            }),
            { onDeleteImage },
          ),
        ],
      }),
    });

    const image = parent.querySelector<HTMLImageElement>(".cm-image-preview img")!;
    image.dispatchEvent(new Event("error"));

    const failedPreview = parent.querySelector<HTMLButtonElement>(".cm-image-preview-error");
    expect(failedPreview?.textContent).toContain("无法加载图片：不存在的图片.png");
    expect(parent.querySelector(".cm-image-preview-action")).not.toBeNull();
    failedPreview?.click();

    expect(parent.querySelector(".cm-image-preview.selected")).not.toBeNull();
    expect(parent.querySelector(".cm-image-reference-line-hidden")).toBeNull();
    expect(parent.querySelector(".cm-line")?.parentElement?.textContent).toContain(source);

    view.contentDOM.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true, cancelable: true }));
    expect(view.state.doc.toString()).toBe("前文\n后文");
    expect(onDeleteImage).toHaveBeenCalledWith("/library/不存在的图片.png");
  });
});
