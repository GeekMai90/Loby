/**
 * [INPUT]: 依赖 Tauri API、React 运行时、CodeMirror 6、编辑器模块、写作库模块、shared 公共契约
 * [OUTPUT]: 对外提供 useEditorImages
 * [POS]: 编辑器 feature 的React 协调边界，封装 编辑器 状态、副作用与用户动作
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { convertFileSrc } from "@tauri-apps/api/core";
import type { RefObject } from "react";
import type { EditorView } from "@codemirror/view";
import { insertImageReferenceBlocks } from "@/features/editor/model/editorInsertions";
import {
  createImageReference,
  getPreferredImageFilename,
  isImageFile,
  resolveInsertedImagePath,
  resolveSheetImageSourcePath,
  stripExtension,
} from "@/features/library/model/imageAssets";
import { importProjectImages, previewLocalImage, saveLocalImageAs, saveProjectImage } from "@/features/library/model/persistence";
import type { WritingProject, WritingSheet } from "@/shared/types";

interface UseEditorImagesOptions {
  activeProject: WritingProject | undefined;
  activeSheet: WritingSheet | undefined;
  libraryPath: string;
  imageReferenceFormat: "markdown" | "obsidian";
  editorRef: RefObject<EditorView | null>;
  onResourcesChanged: () => void;
  onImageStatusChange: (message: string) => void;
  onLibraryStatusChange: (message: string) => void;
}

export function useEditorImages({
  activeProject,
  activeSheet,
  libraryPath,
  imageReferenceFormat,
  editorRef,
  onResourcesChanged,
  onImageStatusChange,
  onLibraryStatusChange,
}: UseEditorImagesOptions) {
  function insertImagesIntoActiveEditor(references: string[]) {
    const view = editorRef.current;
    if (!view || references.length === 0) return;
    const selection = view.state.selection.main;
    insertImageReferenceBlocks(view, references, selection.from, selection.to);
  }

  async function importImagesIntoActiveSheet(files: File[]): Promise<string[]> {
    if (!activeProject || !activeSheet || !libraryPath.startsWith("/")) {
      const message = "当前项目还不能保存图片，请先使用本地写作文件夹。";
      onImageStatusChange(message);
      onLibraryStatusChange(message);
      return [];
    }
    const imageFiles = files.filter(isImageFile);
    if (imageFiles.length === 0) return [];

    onImageStatusChange(`正在导入 ${imageFiles.length} 张图片...`);
    onLibraryStatusChange(`正在导入 ${imageFiles.length} 张图片...`);
    try {
      const references: string[] = [];
      for (const file of imageFiles) {
        const buffer = await file.arrayBuffer();
        const imported = await saveProjectImage(
          libraryPath,
          activeProject,
          getPreferredImageFilename(file, `image-${Date.now()}`),
          Array.from(new Uint8Array(buffer)),
        );
        const referencePath = resolveInsertedImagePath(imported.path, libraryPath, activeProject, activeSheet, imageReferenceFormat);
        references.push(createImageReference(referencePath, stripExtension(imported.name), imageReferenceFormat));
      }
      onResourcesChanged();
      onImageStatusChange(`已导入 ${references.length} 张图片`);
      onLibraryStatusChange(`已导入 ${references.length} 张图片到 assets/images。`);
      return references;
    } catch (error) {
      const message = `导入图片失败：${error instanceof Error ? error.message : String(error)}`;
      onImageStatusChange(message);
      onLibraryStatusChange(message);
      return [];
    }
  }

  async function insertImagesFromPicker() {
    if (!activeProject || !activeSheet || !libraryPath.startsWith("/")) {
      const message = "当前项目还不能插入图片，请先使用本地写作文件夹。";
      onImageStatusChange(message);
      onLibraryStatusChange(message);
      return;
    }

    onImageStatusChange("正在选择图片...");
    onLibraryStatusChange("正在选择图片...");
    try {
      const importedImages = await importProjectImages(libraryPath, activeProject);
      if (importedImages.length === 0) {
        onImageStatusChange("未选择图片");
        onLibraryStatusChange("未选择图片。");
        return;
      }
      const references = importedImages.map((image) => {
        const referencePath = resolveInsertedImagePath(image.path, libraryPath, activeProject, activeSheet, imageReferenceFormat);
        return createImageReference(referencePath, stripExtension(image.name), imageReferenceFormat);
      });
      insertImagesIntoActiveEditor(references);
      onResourcesChanged();
      onImageStatusChange(`已插入 ${references.length} 张图片`);
      onLibraryStatusChange(`已插入 ${references.length} 张图片。`);
    } catch (error) {
      const message = `插入图片失败：${error instanceof Error ? error.message : String(error)}`;
      onImageStatusChange(message);
      onLibraryStatusChange(message);
    }
  }

  function resolveActiveSheetImagePreview(referencePath: string, alt: string) {
    if (!activeProject || !activeSheet || !libraryPath.startsWith("/")) return null;
    const sourcePath = resolveSheetImageSourcePath(libraryPath, activeProject, activeSheet, referencePath);
    if (!sourcePath) return null;
    return {
      src: convertFileSrc(sourcePath),
      alt,
      label: referencePath,
      sourcePath,
    };
  }

  function openImagePreviewSource(sourcePath: string) {
    previewLocalImage(sourcePath).catch((error) => {
      const message = `打开图片失败：${error instanceof Error ? error.message : String(error)}`;
      onImageStatusChange(message);
      onLibraryStatusChange(message);
    });
  }

  function saveImagePreviewAs(sourcePath: string, label: string) {
    saveLocalImageAs(sourcePath, label)
      .then((destinationPath) => {
        if (!destinationPath) return;
        onImageStatusChange("已另存图片");
        onLibraryStatusChange(`已另存图片到 ${destinationPath}`);
      })
      .catch((error) => {
        const message = `另存图片失败：${error instanceof Error ? error.message : String(error)}`;
        onImageStatusChange(message);
        onLibraryStatusChange(message);
      });
  }

  return {
    importImagesIntoActiveSheet,
    insertImagesFromPicker,
    resolveActiveSheetImagePreview,
    openImagePreviewSource,
    saveImagePreviewAs,
  };
}
