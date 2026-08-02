// @vitest-environment happy-dom
/**
 * [INPUT]: 依赖 CodeMirror 6、Vitest 与 editorImagePreview
 * [OUTPUT]: 验证本地、远程与失效图片预览，以及真实选区、复制、剪切、键盘删除和资源清理通知
 * [POS]: 编辑器图片预览的交互回归边界，保护异步加载、失败占位、源码恢复与剪贴板/删除同步
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
  it.each(["Backspace", "Delete"])("deletes a selected image reference with %s", async (key) => {
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
    expect(parent.querySelector(".cm-image-reference-line-selected .cm-image-preview")).not.toBeNull();
    expect(parent.querySelector<HTMLImageElement>(".cm-image-preview img")).toBe(image);
    expect(view.dom.classList.contains("cm-image-selection-active")).toBe(true);

    view.contentDOM.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));

    expect(view.state.doc.toString()).toBe("前文\n\n\n后文");
    expect(parent.querySelector(".cm-image-preview")).toBeNull();
    expect(onDeleteImage).toHaveBeenCalledOnce();
    expect(onDeleteImage).toHaveBeenCalledWith("/library/assets/images/test.png");
  });

  it("copies a selected image as its complete Markdown reference", async () => {
    const parent = document.createElement("div");
    document.body.append(parent);
    const source = "![测试图](assets/images/test.png)";
    view = createImagePreviewView(parent, `前文\n\n${source}\n\n后文`);

    parent.querySelector<HTMLImageElement>(".cm-image-preview img")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const clipboard = new DataTransfer();
    view.contentDOM.dispatchEvent(new ClipboardEvent("copy", { bubbles: true, cancelable: true, clipboardData: clipboard }));

    expect(clipboard.getData("text/plain")).toBe(source);
    expect(clipboard.getData("text/markdown")).toBe(source);
    expect(view.state.doc.toString()).toBe(`前文\n\n${source}\n\n后文`);
  });

  it("cuts the selected image line instead of text at the previous cursor", async () => {
    const onDeleteImage = vi.fn();
    const parent = document.createElement("div");
    document.body.append(parent);
    const source = "![测试图](assets/images/test.png)";
    view = createImagePreviewView(parent, `前文\n\n${source}\n\n不应被剪切的后文`, onDeleteImage);
    view.dispatch({ selection: { anchor: view.state.doc.length } });

    parent.querySelector<HTMLImageElement>(".cm-image-preview img")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const clipboard = new DataTransfer();
    view.contentDOM.dispatchEvent(new ClipboardEvent("cut", { bubbles: true, cancelable: true, clipboardData: clipboard }));

    expect(clipboard.getData("text/plain")).toBe(source);
    expect(view.state.doc.toString()).toBe("前文\n\n\n不应被剪切的后文");
    expect(onDeleteImage).toHaveBeenCalledOnce();
    expect(onDeleteImage).toHaveBeenCalledWith("/library/assets/images/test.png");
  });

  it("clears the selected preview when the user clicks outside the image", async () => {
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
    expect(parent.querySelector(".cm-image-reference-line-selected .cm-image-preview")).not.toBeNull();

    outside.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));

    expect(parent.querySelector(".cm-image-reference-line-selected")).toBeNull();
    expect(view.dom.classList.contains("cm-image-selection-active")).toBe(false);
  });

  it("keeps the rendered image and its live line while text above it shifts", async () => {
    const onDeleteImage = vi.fn();
    const parent = document.createElement("div");
    document.body.append(parent);
    view = createImagePreviewView(parent, "前文\n\n![测试图](assets/images/test.png)\n\n后文", onDeleteImage);

    const image = parent.querySelector<HTMLImageElement>(".cm-image-preview img");
    expect(image).not.toBeNull();

    view.dispatch({ changes: { from: 0, insert: "新" } });

    // 上方输入只移动位置，图片 DOM 必须原样保留，不得重新解码
    expect(parent.querySelector<HTMLImageElement>(".cm-image-preview img")).toBe(image);

    // 行首在事件发生时解析，因此位移后的删除仍然命中正确的那一行
    image!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    view.contentDOM.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true, cancelable: true }));

    expect(view.state.doc.toString()).toBe("新前文\n\n\n后文");
    expect(onDeleteImage).toHaveBeenCalledWith("/library/assets/images/test.png");
  });

  it("does not rebuild image decorations when only the cursor moves", async () => {
    const parent = document.createElement("div");
    document.body.append(parent);
    const resolveImagePreview = vi.fn(() => ({
      src: "asset://localhost/test.png",
      alt: "测试图",
      label: "test.png",
      sourcePath: "/library/assets/images/test.png",
    }));
    view = new EditorView({
      parent,
      state: EditorState.create({
        doc: "前文\n\n![测试图](assets/images/test.png)\n\n后文",
        extensions: [markdown(), imagePreviewDecorations(resolveImagePreview)],
      }),
    });

    const resolvedOnMount = resolveImagePreview.mock.calls.length;
    expect(resolvedOnMount).toBeGreaterThan(0);

    view.dispatch({ selection: { anchor: 1 } });
    view.dispatch({ selection: { anchor: 0 } });

    expect(resolveImagePreview.mock.calls.length).toBe(resolvedOnMount);
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

  it("keeps a failed image selectable, reveals its Markdown source, and deletes it with the keyboard", async () => {
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

    expect(parent.querySelector(".cm-image-reference-line-selected .cm-image-preview")).not.toBeNull();
    expect(parent.querySelector(".cm-image-reference-line-hidden")).toBeNull();
    expect(parent.querySelector(".cm-line")?.parentElement?.textContent).toContain(source);

    view.contentDOM.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true, cancelable: true }));
    expect(view.state.doc.toString()).toBe("前文\n后文");
    expect(onDeleteImage).toHaveBeenCalledWith("/library/不存在的图片.png");
  });
});

function createImagePreviewView(parent: HTMLElement, doc: string, onDeleteImage = vi.fn()) {
  return new EditorView({
    parent,
    state: EditorState.create({
      doc,
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
}
