/**
 * [INPUT]: 依赖 CodeMirror 6 与 editorMarkdownDecorations 的脚注语义构造
 * [OUTPUT]: 对外提供 createEditorFootnoteNavigationExtension、findFootnoteDefinition、findFootnoteReference，并让无正文引用的孤立脚注标签可进入源码
 * [POS]: 编辑器 feature 的脚注导航边界，在阅读态连接正文上标与文末定义；定义无可返回引用时退化为本地源码编辑入口
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { collectMarkdownSyntaxConstructs, type MarkdownSyntaxConstruct } from "@/features/editor/model/editorMarkdownDecorations";

export function createEditorFootnoteNavigationExtension() {
  return EditorView.domEventHandlers({
    mousedown(event, view) {
      if (event.button !== 0 || !(event.target instanceof Element)) return false;

      const reference = event.target.closest<HTMLElement>(".cm-footnote-reference-rendered");
      const definition = event.target.closest<HTMLElement>(".cm-footnote-definition-label");
      const label = reference?.dataset.footnoteLabel ?? definition?.dataset.footnoteLabel;
      if (!label) return false;

      const target = reference ? findFootnoteDefinition(view.state, label) : findFootnoteReference(view.state, label);
      if (!target) {
        const source = definition ? findFootnoteDefinition(view.state, label) : null;
        if (!source) return false;

        event.preventDefault();
        event.stopPropagation();
        view.focus();
        view.dispatch({ selection: { anchor: source.from } });
        return true;
      }

      event.preventDefault();
      event.stopPropagation();
      view.dispatch({ selection: { anchor: target.contentFrom }, scrollIntoView: true });
      view.focus();
      return true;
    },
  });
}

export function findFootnoteDefinition(state: EditorState, label: string): MarkdownSyntaxConstruct | null {
  return findFootnoteConstruct(state, label, "FootnoteDefinition");
}

export function findFootnoteReference(state: EditorState, label: string): MarkdownSyntaxConstruct | null {
  return findFootnoteConstruct(state, label, "FootnoteReference");
}

function findFootnoteConstruct(state: EditorState, label: string, kind: "FootnoteDefinition" | "FootnoteReference") {
  return collectMarkdownSyntaxConstructs(state).find((construct) => construct.kind === kind && construct.label === label) ?? null;
}
