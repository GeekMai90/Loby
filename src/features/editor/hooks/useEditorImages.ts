/**
 * [INPUT]: 依赖 Tauri API、React 运行时、CodeMirror 6、编辑器模块、写作库模块、shared 公共契约
 * [OUTPUT]: 对外提供 useEditorImages，协调本地/远程图片预览，并在本地图片引用删除后延迟清理孤儿资源
 * [POS]: 编辑器 feature 的React 协调边界，封装 编辑器 状态、副作用与用户动作
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { convertFileSrc } from "@tauri-apps/api/core";
import { useEffect, useRef, type RefObject } from "react";
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
import {
  importProjectImages,
  prepareImagePreview,
  previewImage,
  saveLocalImageAs,
  saveProjectImage,
} from "@/features/library/model/persistence";
import { cleanupDeletedImagePathsAfterSave } from "@/features/editor/model/editorDeletedImageCleanup";
import type { WritingProject, WritingSheet } from "@/shared/types";

const DELETED_IMAGE_CLEANUP_DELAY_MS = 1500;

interface UseEditorImagesOptions {
  projects: WritingProject[];
  activeProject: WritingProject | undefined;
  activeSheet: WritingSheet | undefined;
  libraryPath: string;
  imageReferenceFormat: "markdown" | "obsidian";
  editorRef: RefObject<EditorView | null>;
  onResourcesChanged: () => void;
  persistProjectsImmediately: (projects: WritingProject[]) => Promise<void>;
  onTrashChanged: () => void;
  onImageStatusChange: (message: string) => void;
  onLibraryStatusChange: (message: string) => void;
}

export function useEditorImages({
  projects,
  activeProject,
  activeSheet,
  libraryPath,
  imageReferenceFormat,
  editorRef,
  onResourcesChanged,
  persistProjectsImmediately,
  onTrashChanged,
  onImageStatusChange,
  onLibraryStatusChange,
}: UseEditorImagesOptions) {
  const projectsRef = useRef(projects);
  const libraryPathRef = useRef(libraryPath);
  const cleanupTimerRef = useRef<number | null>(null);
  const pendingDeletedImagePathsRef = useRef(new Set<string>());

  useEffect(() => {
    projectsRef.current = projects;
    libraryPathRef.current = libraryPath;
  }, [libraryPath, projects]);

  useEffect(
    () => () => {
      if (cleanupTimerRef.current !== null) window.clearTimeout(cleanupTimerRef.current);
    },
    [],
  );

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
    if (isRemoteImageSource(referencePath)) {
      return {
        src: "",
        loadSrc: async () => convertFileSrc(await prepareImagePreview(referencePath)),
        alt,
        label: referencePath,
        sourcePath: referencePath,
      };
    }
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
    previewImage(sourcePath).catch((error) => {
      const message = `打开图片失败：${error instanceof Error ? error.message : String(error)}`;
      onImageStatusChange(message);
      onLibraryStatusChange(message);
    });
  }

  function saveImagePreviewAs(sourcePath: string, label: string) {
    resolveLocalImagePreviewPath(sourcePath)
      .then((localPath) => saveLocalImageAs(localPath, label))
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

  function scheduleDeletedImageCleanup(sourcePath: string) {
    if (!sourcePath || isRemoteImageSource(sourcePath) || !libraryPath.startsWith("/")) return;
    pendingDeletedImagePathsRef.current.add(sourcePath);
    if (cleanupTimerRef.current !== null) window.clearTimeout(cleanupTimerRef.current);
    const scheduledLibraryPath = libraryPath;
    cleanupTimerRef.current = window.setTimeout(() => {
      cleanupTimerRef.current = null;
      const imagePaths = [...pendingDeletedImagePathsRef.current];
      pendingDeletedImagePathsRef.current.clear();
      if (imagePaths.length === 0 || scheduledLibraryPath !== libraryPathRef.current) return;
      void cleanupDeletedImagePathsAfterSave({
        libraryPath: scheduledLibraryPath,
        imagePaths,
        projects: projectsRef.current,
        persistProjectsImmediately,
      })
        .then((result) => {
          if (result.movedCount === 0) return;
          onResourcesChanged();
          onTrashChanged();
          onLibraryStatusChange(`已将 ${result.movedCount} 张未使用的图片移入废纸篓。`);
        })
        .catch((error) => {
          onLibraryStatusChange(`图片引用已删除，但资源清理失败：${error instanceof Error ? error.message : String(error)}`);
        });
    }, DELETED_IMAGE_CLEANUP_DELAY_MS);
  }

  return {
    importImagesIntoActiveSheet,
    insertImagesFromPicker,
    resolveActiveSheetImagePreview,
    openImagePreviewSource,
    saveImagePreviewAs,
    scheduleDeletedImageCleanup,
  };
}

function isRemoteImageSource(source: string) {
  return /^https?:\/\//i.test(source);
}

function resolveLocalImagePreviewPath(source: string) {
  return isRemoteImageSource(source) ? prepareImagePreview(source) : Promise.resolve(source);
}
