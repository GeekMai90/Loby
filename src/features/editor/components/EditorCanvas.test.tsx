// @vitest-environment happy-dom
/**
 * [INPUT]: 依赖 React DOM、Vitest、CodeMirror 6 与 EditorCanvas
 * [OUTPUT]: 验证延迟 React 正文回声不覆盖更新输入、跨文稿 session 不改写旧编辑器、格式化替换保留光标与视口、预览切换不重建旧正文、编辑区右键菜单替换原生菜单，外部正文仍可显式同步
 * [POS]: 编辑器画布的输入权威与编辑区交互集成回归，直接覆盖受控旧 value、预览卸载或原生右键菜单回退导致的行为回归
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { EditorView } from "@codemirror/view";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WritingSheet } from "@/shared/types";
import { EditorCanvas } from "@/features/editor/components/EditorCanvas";

const reactActEnvironment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  vi.useRealTimers();
});

describe("EditorCanvas document authority", () => {
  it("does not let an older delayed model echo overwrite newer input", async () => {
    vi.useFakeTimers();
    const mounted = mountEditor(sheet("初始正文"));

    await act(async () => {
      mounted.view.dispatch({ changes: { from: mounted.view.state.doc.length, insert: "正在输入" } });
      await vi.advanceTimersByTimeAsync(240);
    });
    const committedBody = mounted.onBodyChange.mock.calls.at(-1)?.[1] as string;
    expect(committedBody).toBe("初始正文正在输入");

    await act(async () => {
      mounted.view.contentDOM.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true, data: "pin" }));
      mounted.view.dispatch({ changes: { from: mounted.view.state.doc.length, insert: " " } });
      root?.render(<EditorCanvas {...createProps(sheet(committedBody), mounted.onCreateEditor, mounted.onBodyChange)} />);
    });

    expect(mounted.view.state.doc.toString()).toBe("初始正文正在输入 ");
    mounted.view.contentDOM.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "拼" }));
  });

  it("still applies an explicit external body replacement", async () => {
    const mounted = mountEditor(sheet("原正文"));

    await act(async () => {
      root?.render(<EditorCanvas {...createProps(sheet("外部替换正文"), mounted.onCreateEditor, mounted.onBodyChange)} />);
    });

    expect(mounted.view.state.doc.toString()).toBe("外部替换正文");
  });

  it("does not apply the next sheet body to the previous editor session", async () => {
    const firstSheet = sheet("第一篇正文", "sheet-1");
    const secondSheet = sheet("第二篇正文", "sheet-2");
    const mounted = mountEditor(firstSheet);
    const firstView = mounted.view;

    await act(async () => {
      root?.render(<EditorCanvas {...createProps(secondSheet, mounted.onCreateEditor, mounted.onBodyChange)} />);
    });

    const secondView = mounted.onCreateEditor.mock.calls.at(-1)?.[0];
    expect(mounted.onCreateEditor).toHaveBeenCalledTimes(2);
    expect(firstView.state.doc.toString()).toBe(firstSheet.body);
    expect(secondView?.state.doc.toString()).toBe(secondSheet.body);
  });

  it("keeps the current cursor when formatting replaces the live body", async () => {
    const initialBody = ["# 标题", "", "第一段", "", "第二段", "", "第五段落"].join("\n");
    const formattedBody = ["# 标题", "", "第一段。", "", "第二段。", "", "第五段落。"].join("\n");
    const initialSheet = sheet(initialBody);
    const mounted = mountEditor(initialSheet);
    const cursor = initialBody.indexOf("第五段落") + 2;

    await act(async () => {
      mounted.view.contentDOM.focus();
      mounted.view.scrollDOM.scrollTop = 480;
      mounted.view.dispatch({ selection: { anchor: cursor } });
      root?.render(<EditorCanvas {...createProps(sheet(formattedBody), mounted.onCreateEditor, mounted.onBodyChange)} />);
    });

    expect(mounted.view.state.selection.main.head).toBe(cursor + 2);
    expect(mounted.view.state.doc.toString()).toBe(formattedBody);
    expect(mounted.view.scrollDOM.scrollTop).toBe(480);
  });

  it("keeps the live EditorView and uncommitted input across preview toggles", async () => {
    vi.useFakeTimers();
    const initialSheet = sheet("初始正文");
    const mounted = mountEditor(initialSheet);

    await act(async () => {
      mounted.view.dispatch({ changes: { from: mounted.view.state.doc.length, insert: "刚写内容" } });
      root?.render(
        <EditorCanvas {...createProps(initialSheet, mounted.onCreateEditor, mounted.onBodyChange)} previewMode previewHtml="<p>预览</p>" />,
      );
      root?.render(<EditorCanvas {...createProps(initialSheet, mounted.onCreateEditor, mounted.onBodyChange)} />);
    });

    expect(mounted.onCreateEditor).toHaveBeenCalledOnce();
    expect(mounted.view.state.doc.toString()).toBe("初始正文刚写内容");
  });

  it("opens the Loby editor menu instead of the native editing menu", async () => {
    const mounted = mountEditor(sheet("初始正文"));

    await act(async () => {
      mounted.view.contentDOM.dispatchEvent(
        new MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
          button: 2,
          clientX: 120,
          clientY: 180,
        }),
      );
    });

    const menu = document.body.querySelector('[data-slot="context-menu-content"]');
    expect(menu).not.toBeNull();
    expect(menu?.textContent).toContain("粘贴");
    expect(menu?.textContent).toContain("全选");
    expect(menu?.textContent).not.toContain("Spelling and Grammar");
    expect(menu?.textContent).not.toContain("AutoFill");
  });
});

function mountEditor(initialSheet: WritingSheet) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  let view: EditorView | null = null;
  const onCreateEditor = vi.fn((nextView: EditorView) => {
    view = nextView;
  });
  const onBodyChange = vi.fn<ComponentProps<typeof EditorCanvas>["onBodyChange"]>();

  act(() => {
    root?.render(<EditorCanvas {...createProps(initialSheet, onCreateEditor, onBodyChange)} />);
  });

  if (!view) throw new Error("EditorCanvas did not create CodeMirror");
  return { view: view as EditorView, onCreateEditor, onBodyChange };
}

function createProps(
  currentSheet: WritingSheet,
  onCreateEditor: ComponentProps<typeof EditorCanvas>["onCreateEditor"],
  onBodyChange: ComponentProps<typeof EditorCanvas>["onBodyChange"],
): ComponentProps<typeof EditorCanvas> {
  return {
    sheet: currentSheet,
    documentSessionKey: `live:${currentSheet.id}`,
    previewMode: false,
    previewHtml: "",
    previewBusy: false,
    typewriterMode: false,
    typography: {
      fontPreset: "system",
      customFontFamily: "",
      lineHeight: 1.8,
      paragraphSpacing: 0,
      bodyFontSize: 16,
      h1FontSize: 30,
      h2FontSize: 24,
      h3FontSize: 20,
      tableFontSize: 14,
    },
    reviewChanges: [],
    onCreateEditor,
    onBodyInput: vi.fn(),
    onBodyChange,
    onSelectionChange: vi.fn(),
    onRunInlineAi: vi.fn(async () => ({ resultType: "answer" as const, content: "" })),
    onCancelInlineAi: vi.fn(),
    onHandoffInlineAi: vi.fn(),
    onApplyInlineAiEdit: vi.fn(() => true),
    onRejectInlineAiEdit: vi.fn(() => true),
    onImportImageFiles: vi.fn(async () => []),
    onResolveImagePreview: vi.fn(() => null),
    onOpenImage: vi.fn(),
    onSaveImageAs: vi.fn(),
    onDeleteImage: vi.fn(),
    onInsertImage: vi.fn(),
  };
}

function sheet(body: string, id = "sheet-1"): WritingSheet {
  return {
    id,
    title: "测试文稿",
    groupId: "group-1",
    tags: [],
    targetWords: 1000,
    description: "",
    body,
    createdAt: "2026-07-29 12:00:00",
    updatedAt: "2026-07-29 12:00:00",
    properties: {},
  };
}
