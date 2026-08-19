// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React DOM、Vitest、CodeMirror/pending reader 测试替身与 useLiveDocumentProjection
 * [OUTPUT]: 验证 live/pending 正文物化、预览/发布快照、标题/更新时间投影与预览失败收口
 * [POS]: editor 实时正文投影生命周期的聚焦回归测试，保护 App 拆分后外部 surface 不读取延迟 React 正文
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { EditorView } from "@codemirror/view";
import { act, createElement, type RefObject } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLiveDocumentProjection, type PendingEditorDocumentReader } from "@/features/editor/hooks/useLiveDocumentProjection";
import type { WritingSheet } from "@/shared/types";

const savedSheet: WritingSheet = {
  id: "sheet-live",
  title: "Saved title",
  body: "# Saved title\n\nSaved body",
  tags: [],
  targetWords: 0,
  description: "",
  properties: {},
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

interface ProjectionHarnessProps {
  activeSheet: WritingSheet;
  editorDocumentSessionKey: string;
  editorRef: RefObject<EditorView | null>;
  pendingDocumentsRef: RefObject<Map<string, PendingEditorDocumentReader>>;
  previewMode: boolean;
  publishingMode: boolean;
  renderPreviewHtml: (markdown: string) => Promise<string>;
}

function ProjectionHarness(props: ProjectionHarnessProps) {
  const projection = useLiveDocumentProjection(props);
  const materialized = projection.materializeLatestSheet(props.activeSheet);
  return createElement(
    "section",
    null,
    createElement("output", { "data-testid": "materialized" }, JSON.stringify(materialized)),
    createElement("output", { "data-testid": "publishing-sheet" }, JSON.stringify(projection.latestSheetForPublishing)),
    createElement("output", { "data-testid": "preview-html" }, projection.previewHtml),
    createElement("output", { "data-testid": "preview-busy" }, String(projection.previewBusy)),
  );
}

describe("useLiveDocumentProjection", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  async function renderProjection(props: ProjectionHarnessProps) {
    await act(async () => {
      root.render(createElement(ProjectionHarness, props));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  function readSheet(testId: string): WritingSheet {
    return JSON.parse(container.querySelector(`[data-testid="${testId}"]`)?.textContent ?? "null") as WritingSheet;
  }

  it("projects the live CodeMirror body into preview and publishing surfaces", async () => {
    const liveBody = "# Live title\n\nLatest editor body";
    const editorRef = {
      current: { state: { doc: { toString: () => liveBody } } },
    } as unknown as RefObject<EditorView | null>;
    const pendingDocumentsRef = { current: new Map<string, PendingEditorDocumentReader>() };
    const renderPreviewHtml = vi.fn(async (markdown: string) => `<article>${markdown}</article>`);

    await renderProjection({
      activeSheet: savedSheet,
      editorDocumentSessionKey: `live:${savedSheet.id}`,
      editorRef,
      pendingDocumentsRef,
      previewMode: true,
      publishingMode: true,
      renderPreviewHtml,
    });

    expect(readSheet("materialized")).toMatchObject({ title: "Live title", body: liveBody });
    expect(readSheet("publishing-sheet")).toMatchObject({ title: "Live title", body: liveBody });
    expect(renderPreviewHtml).toHaveBeenLastCalledWith(liveBody);
    expect(container.querySelector('[data-testid="preview-html"]')?.textContent).toBe(`<article>${liveBody}</article>`);
    expect(container.querySelector('[data-testid="preview-busy"]')?.textContent).toBe("false");
  });

  it("uses the pending reader outside the live session and closes preview failures", async () => {
    const pendingBody = "# Pending title\n\nBuffered editor body";
    const editorRef = { current: null } satisfies RefObject<EditorView | null>;
    const pendingDocumentsRef = {
      current: new Map<string, PendingEditorDocumentReader>([
        [savedSheet.id, { readBody: () => pendingBody, updatedAt: "2026-02-02T00:00:00.000Z" }],
      ]),
    };
    const renderPreviewHtml = vi.fn(async () => {
      throw new Error("render failed");
    });

    await renderProjection({
      activeSheet: savedSheet,
      editorDocumentSessionKey: `version:${savedSheet.id}:version-1`,
      editorRef,
      pendingDocumentsRef,
      previewMode: true,
      publishingMode: false,
      renderPreviewHtml,
    });

    expect(readSheet("materialized")).toMatchObject({
      title: "Pending title",
      body: pendingBody,
      updatedAt: "2026-02-02T00:00:00.000Z",
    });
    expect(container.querySelector('[data-testid="preview-html"]')?.textContent).toBe("<pre>Markdown preview failed.</pre>");
    expect(container.querySelector('[data-testid="preview-busy"]')?.textContent).toBe("false");
  });
});
