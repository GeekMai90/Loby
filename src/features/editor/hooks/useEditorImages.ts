/**
 * [INPUT]: 依赖 Tauri API、React 运行时、CodeMirror 6、编辑器模块、写作库模块、媒体模块与 shared 公共契约
 * [OUTPUT]: 对外提供 useEditorImages，以标准 Markdown 插入本地/Unsplash 图片、协调图片预览，并在引用删除后延迟清理孤儿资源
 * [POS]: 编辑器 feature 的React 协调边界，封装 编辑器 状态、副作用与用户动作
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { convertFileSrc } from "@tauri-apps/api/core";
import { useEffect, useRef, type RefObject } from "react";
import type { EditorView } from "@codemirror/view";
import { insertImageReferenceBlocks } from "@/features/editor/model/editorInsertions";
import {
  createMarkdownImageReference,
  getPreferredImageFilename,
  isImageFile,
  resolveInsertedMarkdownImagePath,
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
import { isDesktopLibraryPath } from "@/features/library/model/libraryRegistry";
import type { WritingProject, WritingSheet } from "@/shared/types";
import { saveUnsplashImage, type UnsplashCrop, type UnsplashPhoto } from "@/features/media/model/unsplash";

const DELETED_IMAGE_CLEANUP_DELAY_MS = 1500;

interface UseEditorImagesOptions {
  projects: WritingProject[];
  activeProject: WritingProject | undefined;
  activeSheet: WritingSheet | undefined;
  libraryPath: string;
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
  editorRef,
  onResourcesChanged,
  persistProjectsImmediately,
  onTrashChanged,
  onImageStatusChange,
  onLibraryStatusChange,
}: UseEditorImagesOptions) {
  const projectsRef = useRef(projects);
  const libraryPathRef = useRef(libraryPath);
  const activeProjectIdRef = useRef(activeProject?.id ?? "");
  const activeSheetIdRef = useRef(activeSheet?.id ?? "");
  const cleanupTimerRef = useRef<number | null>(null);
  const pendingDeletedImagePathsRef = useRef(new Set<string>());

  useEffect(() => {
    projectsRef.current = projects;
    libraryPathRef.current = libraryPath;
    activeProjectIdRef.current = activeProject?.id ?? "";
    activeSheetIdRef.current = activeSheet?.id ?? "";
  }, [activeProject?.id, activeSheet?.id, libraryPath, projects]);

  useEffect(
    () => () => {
      if (cleanupTimerRef.current !== null) window.clearTimeout(cleanupTimerRef.current);
    },
    [],
  );

  function insertImagesIntoActiveEditor(references: string[]) {
    const view = editorRef.current;
    if (!view || references.length === 0) return false;
    const selection = view.state.selection.main;
    return insertImageReferenceBlocks(view, references, selection.from, selection.to) !== null;
  }

  async function importImagesIntoActiveSheet(files: File[]): Promise<string[]> {
    if (!activeProject || !activeSheet || !isDesktopLibraryPath(libraryPath)) {
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
        const referencePath = resolveInsertedMarkdownImagePath(imported.path, libraryPath, activeProject, activeSheet);
        references.push(createMarkdownImageReference(referencePath, stripExtension(imported.name)));
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

  async function insertImagesFromPicker(): Promise<boolean> {
    if (!activeProject || !activeSheet || !isDesktopLibraryPath(libraryPath)) {
      const message = "当前项目还不能插入图片，请先使用本地写作文件夹。";
      onImageStatusChange(message);
      onLibraryStatusChange(message);
      return false;
    }

    onImageStatusChange("正在选择图片...");
    onLibraryStatusChange("正在选择图片...");
    try {
      const importedImages = await importProjectImages(libraryPath, activeProject);
      if (importedImages.length === 0) {
        onImageStatusChange("未选择图片");
        onLibraryStatusChange("未选择图片。");
        return false;
      }
      const references = importedImages.map((image) => {
        const referencePath = resolveInsertedMarkdownImagePath(image.path, libraryPath, activeProject, activeSheet);
        return createMarkdownImageReference(referencePath, stripExtension(image.name));
      });
      const inserted = insertImagesIntoActiveEditor(references);
      if (!inserted) {
        const message = "当前编辑器不可用，图片尚未插入。";
        onImageStatusChange(message);
        onLibraryStatusChange(message);
        return false;
      }
      onResourcesChanged();
      onImageStatusChange(`已插入 ${references.length} 张图片`);
      onLibraryStatusChange(`已插入 ${references.length} 张图片。`);
      return true;
    } catch (error) {
      const message = `插入图片失败：${error instanceof Error ? error.message : String(error)}`;
      onImageStatusChange(message);
      onLibraryStatusChange(message);
      return false;
    }
  }

  async function insertUnsplashImage(photo: UnsplashPhoto, crop: UnsplashCrop): Promise<boolean> {
    if (!activeProject || !activeSheet || !isDesktopLibraryPath(libraryPath)) {
      const message = "当前项目还不能保存图片，请先使用本地写作文件夹。";
      onImageStatusChange(message);
      onLibraryStatusChange(message);
      return false;
    }
    if (!editorRef.current) {
      const message = "当前编辑器不可用，图片尚未插入。";
      onImageStatusChange(message);
      onLibraryStatusChange(message);
      return false;
    }

    const targetEditor = editorRef.current;
    const targetProjectId = activeProject.id;
    const targetSheetId = activeSheet.id;
    const targetLibraryPath = libraryPath;

    onImageStatusChange("正在下载并裁剪 Unsplash 图片...");
    onLibraryStatusChange("正在下载并裁剪 Unsplash 图片...");
    try {
      const imported = await saveUnsplashImage({
        path: targetLibraryPath,
        projectId: targetProjectId,
        projectTitle: activeProject.title,
        photoId: photo.id,
        imageUrl: photo.urls.raw || photo.urls.regular,
        downloadLocation: photo.links.downloadLocation,
        crop,
      });
      const targetIsStillActive =
        editorRef.current === targetEditor &&
        activeProjectIdRef.current === targetProjectId &&
        activeSheetIdRef.current === targetSheetId &&
        libraryPathRef.current === targetLibraryPath;
      if (!targetIsStillActive) {
        if (libraryPathRef.current === targetLibraryPath) scheduleDeletedImageCleanup(imported.path);
        const message = "文稿已切换，图片已保存到 assets/images，但尚未插入当前文稿。";
        onImageStatusChange(message);
        onLibraryStatusChange(message);
        return false;
      }

      const referencePath = resolveInsertedMarkdownImagePath(imported.path, libraryPath, activeProject, activeSheet);
      const reference = createMarkdownImageReference(referencePath, photo.altDescription || photo.description || "图片");
      if (!insertImagesIntoActiveEditor([reference])) {
        scheduleDeletedImageCleanup(imported.path);
        const message = "当前编辑器不可用，图片已下载但尚未插入。";
        onImageStatusChange(message);
        onLibraryStatusChange(message);
        return false;
      }
      onResourcesChanged();
      onImageStatusChange("已下载并插入 Unsplash 图片");
      onLibraryStatusChange("已将裁剪后的图片保存到 assets/images。");
      return true;
    } catch (error) {
      const message = `插入 Unsplash 图片失败：${error instanceof Error ? error.message : String(error)}`;
      onImageStatusChange(message);
      onLibraryStatusChange(message);
      return false;
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
    if (!activeProject || !activeSheet || !isDesktopLibraryPath(libraryPath)) return null;
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
    if (!sourcePath || isRemoteImageSource(sourcePath) || !isDesktopLibraryPath(libraryPath)) return;
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
    insertUnsplashImage,
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
