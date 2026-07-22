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

  if (!context.libraryPath.startsWith("/") || !context.activeProject || !context.activeSheet) return null;
  if (action.targetProjectId && context.activeProject.id !== action.targetProjectId) return null;
  if (action.targetSheetId && context.activeSheet.id !== action.targetSheetId) return null;

  const sourcePath = resolveSheetImageSourcePath(context.libraryPath, context.activeProject, context.activeSheet, path);
  if (!sourcePath) return null;

  return {
    src: convertFileSrc(sourcePath),
    alt,
    label: path,
    sourcePath,
  };
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
