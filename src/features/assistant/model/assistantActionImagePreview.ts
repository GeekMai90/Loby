/**
 * [INPUT]: 依赖 Tauri asset URL、AiAction 图片来源契约与写作库图片路径解析
 * [OUTPUT]: 对外提供确认前缓存成果、确认后持久图片统一使用的单图/批量 InsertImageActionPreview
 * [POS]: AI 助手图片预览路径边界，按 action 状态选择运行时来源或写作库来源，并展开批量图片身份
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { convertFileSrc } from "@tauri-apps/api/core";
import type { AiAction, WritingProject, WritingSheet } from "@/shared/types";
import { resolveSheetImageSourcePath } from "@/features/library/model/imageAssets";
import { isDesktopLibraryPath } from "@/features/library/model/libraryRegistry";
import { expandImageActions } from "@/features/assistant/model/agentImageArtifacts";

export interface InsertImageActionPreview {
  src: string;
  alt: string;
  label: string;
  sourcePath: string;
}

interface ActionTargetContext {
  libraryPath: string;
  projects?: WritingProject[];
  activeProject?: WritingProject;
  activeSheet?: WritingSheet;
}

export function buildInsertImageActionPreview(action: AiAction, context: ActionTargetContext): InsertImageActionPreview | null {
  if (action.type !== "insertImage") return null;
  const path = stringValue(action.payload.path);
  if (!path) return null;
  const alt = stringValue(action.payload.alt) || action.title;
  const sourceArtifactPath = stringValue(action.sourceArtifactPath);

  if (sourceArtifactPath && action.status !== "applied" && action.status !== "reverted") {
    return {
      src: convertFileSrc(sourceArtifactPath),
      alt,
      label: path,
      sourcePath: sourceArtifactPath,
    };
  }

  if (/^https?:\/\//i.test(path)) {
    return {
      src: path,
      alt,
      label: path,
      sourcePath: path,
    };
  }

  if (!isDesktopLibraryPath(context.libraryPath)) return null;
  const project = resolveTargetProject(action, context);
  const sheet = resolveTargetSheet(action, context, project);
  if (!project || !sheet) return null;

  const sourcePath = resolveSheetImageSourcePath(context.libraryPath, project, sheet, path);
  if (!sourcePath) return null;

  return {
    src: convertFileSrc(sourcePath),
    alt,
    label: path,
    sourcePath,
  };
}

export function buildInsertImageActionPreviews(action: AiAction, context: ActionTargetContext): InsertImageActionPreview[] {
  return expandImageActions(action).flatMap((item) => {
    const preview = buildInsertImageActionPreview(item, context);
    return preview ? [preview] : [];
  });
}

function resolveTargetProject(action: AiAction, context: ActionTargetContext) {
  if (action.targetSheetId) {
    const currentOwner = context.projects?.find((project) => project.sheets.some((sheet) => sheet.id === action.targetSheetId));
    if (currentOwner) return currentOwner;
    if (context.activeSheet?.id === action.targetSheetId && context.activeProject) return context.activeProject;
  }
  if (action.targetProjectId) {
    return (
      context.projects?.find((project) => project.id === action.targetProjectId) ??
      (context.activeProject?.id === action.targetProjectId ? context.activeProject : undefined)
    );
  }
  return context.activeProject;
}

function resolveTargetSheet(action: AiAction, context: ActionTargetContext, project: WritingProject | undefined) {
  if (action.targetSheetId) {
    return (
      project?.sheets.find((sheet) => sheet.id === action.targetSheetId) ??
      (context.activeSheet?.id === action.targetSheetId ? context.activeSheet : undefined)
    );
  }
  return context.activeSheet;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
