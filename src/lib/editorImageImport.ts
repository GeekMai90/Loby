import { EditorView } from "@codemirror/view";
import { insertImageReferenceBlocks } from "./editorInsertions";

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
