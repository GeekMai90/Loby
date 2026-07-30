/**
 * [INPUT]: 依赖 编辑器模块、AI 助手模块
 * [OUTPUT]: 对外提供 AiResolvedDocumentInsertion、buildEditorAiTextInsertion、buildEditorAiImageInsertion、buildEditorAiImageBatchInsertion
 * [POS]: AI 助手写入规划边界，先在纯文稿副本解析单项或批量锚点，再允许编辑器提交事务
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import {
  buildImageReferenceDocumentInsertion,
  buildMarkdownTextDocumentInsertion,
  type MarkdownDocumentInsertion,
} from "@/features/editor/model/editorInsertions";
import {
  normalizeAiInsertionTarget,
  resolveEditorInsertionRange,
  type EditorInsertionRange,
} from "@/features/assistant/model/aiInsertionTarget";

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

export function buildEditorAiImageBatchInsertion(
  options: Omit<BuildEditorInsertionOptions, "target" | "anchor"> & {
    items: Array<{ target: unknown; anchor?: unknown; reference: string }>;
  },
): AiResolvedDocumentInsertion {
  if (options.editorBody !== options.sheetBody) {
    return { ok: false, message: "当前编辑器内容和文稿数据不同步，请稍后重试，避免 AI 写入过期内容。" };
  }
  let body = options.editorBody;
  let selection = options.selection;
  let lastRange = selection;
  for (const item of options.items) {
    const target = normalizeAiInsertionTarget(item.target);
    const range = resolveEditorInsertionRange(target, body, selection, item.anchor);
    if (!range.ok) return range;
    const insertion = buildImageReferenceDocumentInsertion(body, range.range.from, range.range.to, [item.reference]);
    if (!insertion) return { ok: false, message: "AI 插入图片内容为空，无法执行。" };
    body = insertion.body;
    selection = { from: insertion.cursor, to: insertion.cursor, head: insertion.cursor };
    lastRange = range.range;
  }
  return { ok: true, insertion: { body, cursor: selection.to }, range: lastRange };
}

function buildEditorAiDocumentInsertion(
  options: BuildEditorInsertionOptions,
  buildInsertion: (body: string, from: number, to: number) => MarkdownDocumentInsertion | null,
): AiResolvedDocumentInsertion {
  if (options.editorBody !== options.sheetBody) {
    return {
      ok: false,
      message: "当前编辑器内容和文稿数据不同步，请稍后重试，避免 AI 写入过期内容。",
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
