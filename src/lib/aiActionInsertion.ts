import {
  buildImageReferenceDocumentInsertion,
  buildMarkdownTextDocumentInsertion,
  type MarkdownDocumentInsertion,
} from "./editorInsertions";
import { normalizeAiInsertionTarget, resolveEditorInsertionRange, type EditorInsertionRange } from "./aiInsertionTarget";

export type AiResolvedDocumentInsertion =
  { ok: true; insertion: MarkdownDocumentInsertion; range: EditorInsertionRange } | { ok: false; message: string };

interface BuildEditorInsertionOptions {
  sheetBody: string;
  editorBody: string;
  selection: EditorInsertionRange;
  target: unknown;
  anchor?: unknown;
}

interface BuildEditorTextInsertionOptions extends BuildEditorInsertionOptions {
  text: string;
}

interface BuildEditorImageInsertionOptions extends BuildEditorInsertionOptions {
  reference: string;
}

export function buildEditorAiTextInsertion(options: BuildEditorTextInsertionOptions): AiResolvedDocumentInsertion {
  return buildEditorAiDocumentInsertion(options, (body, from, to) => buildMarkdownTextDocumentInsertion(body, from, to, options.text));
}

export function buildEditorAiImageInsertion(options: BuildEditorImageInsertionOptions): AiResolvedDocumentInsertion {
  return buildEditorAiDocumentInsertion(options, (body, from, to) =>
    buildImageReferenceDocumentInsertion(body, from, to, [options.reference]),
  );
}

function buildEditorAiDocumentInsertion(
  options: BuildEditorInsertionOptions,
  buildInsertion: (body: string, from: number, to: number) => MarkdownDocumentInsertion | null,
): AiResolvedDocumentInsertion {
  if (options.editorBody !== options.sheetBody) {
    return {
      ok: false,
      message: "当前编辑器内容和文稿状态不同步，请稍后重试，避免 AI 写入过期内容。",
    };
  }

  const target = normalizeAiInsertionTarget(options.target);
  const range = resolveEditorInsertionRange(target, options.editorBody, options.selection, options.anchor);
  if (!range.ok) return range;

  const insertion = buildInsertion(options.editorBody, range.range.from, range.range.to);
  if (!insertion) {
    return { ok: false, message: "AI 插入内容为空，无法执行。" };
  }

  return { ok: true, insertion, range: range.range };
}
