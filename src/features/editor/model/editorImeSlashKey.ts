/**
 * [INPUT]: 依赖 CodeMirror state/view 的事务与 DOM 事件面，以及 shared 的斜杠键归一与触发字符
 * [OUTPUT]: 对外提供 imeSlashKeyExtension
 * [POS]: 编辑器 feature 的输入法适配层，位于 slashMenuExtension 上游；先把 IME 上屏的斜杠替身改回 `/`，菜单才只需认一种字符
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { EditorState, Prec, type ChangeSet, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { createSlashKeyTracker, normalizeSlashKeyInput } from "@/shared/lib/imeSlashKey";

interface DocumentInsertion {
  from: number;
  to: number;
  text: string;
}

/**
 * 中文输入法把物理 `/` 键上屏为顿号或全角斜杠时，按键位把它改写回半角 `/`。
 * 改写发生在事务落库之前，因此不会有「先显示顿号再跳成斜杠」的闪烁。
 */
export function imeSlashKeyExtension(): Extension {
  const tracker = createSlashKeyTracker();
  return [
    // 记录必须发生在任何 keymap 之前，否则被消费掉的按键就丢了键位信息。
    Prec.highest(
      EditorView.domEventHandlers({
        keydown(event) {
          tracker.observeKeyDown(event);
          return false;
        },
      }),
    ),
    EditorState.transactionFilter.of((transaction) => {
      // 只归一键入（含 IME 组合提交的 input.type.compose），粘贴与拖放不参与。
      if (!transaction.docChanged || !transaction.isUserEvent("input.type")) return transaction;
      const insertion = readSingleInsertion(transaction.changes);
      if (!insertion) return transaction;
      const normalized = normalizeSlashKeyInput(insertion.text, insertion.text.length, tracker);
      if (normalized === insertion.text) return transaction;
      return {
        changes: { from: insertion.from, to: insertion.to, insert: normalized },
        selection: { anchor: insertion.from + normalized.length },
        userEvent: "input.type",
        scrollIntoView: true,
      };
    }),
  ];
}

/** IME 上屏是单点插入；多点变更来自批量命令或协同，一律不归一。 */
function readSingleInsertion(changes: ChangeSet): DocumentInsertion | null {
  const insertions: DocumentInsertion[] = [];
  changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
    insertions.push({ from: fromA, to: toA, text: inserted.toString() });
  });
  return insertions.length === 1 ? (insertions[0] ?? null) : null;
}
