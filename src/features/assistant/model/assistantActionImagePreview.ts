/**
 * [INPUT]: 依赖 Tauri API、shared 公共契约、写作库模块
 * [OUTPUT]: 对外提供 InsertImageActionPreview、buildInsertImageActionPreview
 * [POS]: AI 助手 feature 的领域模型边界，集中 AI 助手 规则、数据转换与外部契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { convertFileSrc } from "@tauri-apps/api/core";
import type { AiAction, WritingProject, WritingSheet } from "@/shared/types";
import { resolveSheetImageSourcePath } from "@/features/library/model/imageAssets";

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

  if (/^https?:\/\//i.test(path)) {
    return {
      src: path,
      alt,
      label: path,
      sourcePath: path,
    };
  }

  if (!context.libraryPath.startsWith("/")) return null;
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

function resolveTargetProject(action: AiAction, context: ActionTargetContext) {
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
