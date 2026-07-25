/**
 * [INPUT]: 依赖 shared 公共契约
 * [OUTPUT]: 对外提供默认固定侧边设置、停靠空间阈值、展示形态解析与旧设置迁移
 * [POS]: AI 助手 feature 的展示策略边界，分离持久化固定偏好、空间降级与单次手动覆盖
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { AssistantPresentation } from "@/shared/types";

export const DEFAULT_ASSISTANT_DOCKED_BY_DEFAULT = true;
export const MIN_DOCKED_EDITOR_WIDTH = 620;
export const DEFAULT_LIBRARY_RAIL_WIDTH = 180;

interface ResolveAssistantPresentationOptions {
  dockedByDefault: boolean;
  manualOverride?: AssistantPresentation | null;
  viewportWidth: number;
  libraryRailOpen: boolean;
  sheetRailOpen: boolean;
  sheetRailWidth: number;
  inspectorWidth: number;
}

export function resolveAssistantPresentation({
  dockedByDefault,
  manualOverride,
  viewportWidth,
  libraryRailOpen,
  sheetRailOpen,
  sheetRailWidth,
  inspectorWidth,
}: ResolveAssistantPresentationOptions): AssistantPresentation {
  if (manualOverride) return manualOverride;
  if (!dockedByDefault) return "floating";

  const projectedEditorWidth =
    viewportWidth - (libraryRailOpen ? DEFAULT_LIBRARY_RAIL_WIDTH : 0) - (sheetRailOpen ? sheetRailWidth : 0) - inspectorWidth;
  return projectedEditorWidth >= MIN_DOCKED_EDITOR_WIDTH ? "docked" : "floating";
}

export function normalizeAssistantDockedByDefault(value: unknown, legacyPreference?: unknown): boolean {
  if (typeof value === "boolean") return value;
  return legacyPreference !== "floating";
}
