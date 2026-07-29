// @vitest-environment happy-dom
/**
 * [INPUT]: 依赖 React DOM、Vitest、CodeMirror 6 与 EditorCanvas
 * [OUTPUT]: 验证延迟 React 正文回声不覆盖更新输入，外部正文仍可显式同步
 * [POS]: 编辑器画布的输入权威集成回归，直接覆盖受控旧 value 导致空格丢失与 IME composition 被打断的根因
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
      await vi.advanceTimersByTimeAsync(120);
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
    onRevealPosition: vi.fn(),
  };
}

function sheet(body: string): WritingSheet {
  return {
    id: "sheet-1",
    title: "测试文稿",
    groupId: "group-1",
    status: "构思",
    tags: [],
    targetWords: 1000,
    description: "",
    body,
    createdAt: "2026-07-29 12:00:00",
    updatedAt: "2026-07-29 12:00:00",
    properties: {},
  };
}
