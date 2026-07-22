/**
 * [INPUT]: 依赖 CodeMirror 6、编辑器模块
 * [OUTPUT]: 对外提供 createImageImportExtension
 * [POS]: 编辑器 feature 的领域模型边界，集中 编辑器 规则、数据转换与外部契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { EditorView } from "@codemirror/view";
import { insertImageReferenceBlocks } from "@/features/editor/model/editorInsertions";

export function createImageImportExtension(onImportImageFiles: (files: File[]) => Promise<string[]>) {
  return EditorView.domEventHandlers({
    paste(event, view) {
      const files = getImageFilesFromClipboard(event.clipboardData);
      if (files.length === 0) return false;
      event.preventDefault();
      void onImportImageFiles(files).then((references) => {
        insertImageReferenceBlocks(view, references, view.state.selection.main.from, view.state.selection.main.to);
      });
      return true;
    },
    drop(event, view) {
      const files = getImageFilesFromDataTransfer(event.dataTransfer);
      if (files.length === 0) return false;
      event.preventDefault();
      const position = view.posAtCoords({ x: event.clientX, y: event.clientY }) ?? view.state.selection.main.from;
      void onImportImageFiles(files).then((references) => {
        insertImageReferenceBlocks(view, references, position, position);
      });
      return true;
    },
  });
}

function getImageFilesFromClipboard(data: DataTransfer | null): File[] {
  if (!data) return [];
  return Array.from(data.items)
    .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file));
}

function getImageFilesFromDataTransfer(data: DataTransfer | null): File[] {
  if (!data) return [];
  return Array.from(data.files).filter((file) => file.type.startsWith("image/"));
}
