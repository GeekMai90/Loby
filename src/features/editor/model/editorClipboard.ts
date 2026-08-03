/**
 * [INPUT]: 依赖 CodeMirror EditorView、浏览器 Clipboard API 与 DataTransfer
 * [OUTPUT]: 对外提供编辑区选区判断、文本复制/剪切与文本/图片粘贴动作
 * [POS]: editor feature 的剪贴板边界，把自定义右键菜单动作转换为 CodeMirror 事务，并保留图片粘贴扩展的事件入口
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { EditorView } from "@codemirror/view";

export function hasEditorSelection(view: EditorView): boolean {
  return view.state.selection.ranges.some((range) => !range.empty);
}

export function selectedEditorText(view: EditorView): string {
  return view.state.selection.ranges
    .filter((range) => !range.empty)
    .map((range) => view.state.sliceDoc(range.from, range.to))
    .join(view.state.lineBreak);
}

export async function copyEditorSelection(view: EditorView): Promise<boolean> {
  if (!hasEditorSelection(view)) return false;
  view.focus();
  if (executeNativeClipboardCommand("copy")) return true;

  return writeClipboardText(selectedEditorText(view));
}

export async function cutEditorSelection(view: EditorView): Promise<boolean> {
  if (!hasEditorSelection(view)) return false;
  view.focus();
  if (executeNativeClipboardCommand("cut")) return true;

  if (!(await writeClipboardText(selectedEditorText(view)))) return false;
  const changes = view.state.selection.ranges.filter((range) => !range.empty).map((range) => ({ from: range.from, to: range.to }));
  view.focus();
  view.dispatch({
    changes,
    scrollIntoView: true,
    userEvent: "delete.cut",
  });
  return true;
}

export async function pasteEditorClipboard(view: EditorView): Promise<boolean> {
  const transfer = await readClipboardDataTransfer();
  if (transfer) {
    view.focus();
    if (typeof ClipboardEvent === "function") {
      view.contentDOM.dispatchEvent(
        new ClipboardEvent("paste", {
          bubbles: true,
          cancelable: true,
          clipboardData: transfer,
        }),
      );
      return true;
    }

    const text = transfer.getData("text/plain");
    if (text) return insertPastedText(view, text);
  }

  const text = await readClipboardText();
  if (text === null) return false;
  return insertPastedText(view, text);
}

function insertPastedText(view: EditorView, text: string): boolean {
  view.focus();
  view.dispatch({
    ...view.state.replaceSelection(text),
    scrollIntoView: true,
    userEvent: "input.paste",
  });
  return true;
}

function executeNativeClipboardCommand(command: "copy" | "cut"): boolean {
  if (typeof document.execCommand !== "function") return false;
  try {
    return document.execCommand(command);
  } catch {
    return false;
  }
}

async function writeClipboardText(text: string): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

async function readClipboardDataTransfer(): Promise<DataTransfer | null> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.read || typeof DataTransfer !== "function") return null;

  try {
    const transfer = new DataTransfer();
    let hasData = false;
    for (const item of await navigator.clipboard.read()) {
      for (const type of item.types) {
        if (type === "text/plain") {
          transfer.setData("text/plain", await (await item.getType(type)).text());
          hasData = true;
          continue;
        }
        if (!type.startsWith("image/")) continue;
        const blob = await item.getType(type);
        transfer.items.add(new File([blob], `pasted-image.${imageExtension(type)}`, { type }));
        hasData = true;
      }
    }
    return hasData ? transfer : null;
  } catch {
    return null;
  }
}

async function readClipboardText(): Promise<string | null> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.readText) return null;
  try {
    return await navigator.clipboard.readText();
  } catch {
    return null;
  }
}

function imageExtension(type: string): string {
  const extension = type.slice("image/".length).split(";")[0]?.trim();
  return extension && /^[a-z0-9]+$/i.test(extension) ? extension : "png";
}
