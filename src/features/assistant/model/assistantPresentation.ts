/**
 * [INPUT]: 依赖 shared 公共契约
 * [OUTPUT]: 对外提供 DEFAULT_ASSISTANT_PRESENTATION_PREFERENCE、MIN_DOCKED_EDITOR_WIDTH、DEFAULT_LIBRARY_RAIL_WIDTH、resolveAssistantPresentation、normalizeAssistantPresentationPreference
 * [POS]: AI 助手 feature 的领域模型边界，集中 AI 助手 规则、数据转换与外部契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { AssistantPresentation, AssistantPresentationPreference } from "@/shared/types";

export const DEFAULT_ASSISTANT_PRESENTATION_PREFERENCE: AssistantPresentationPreference = "auto";
export const MIN_DOCKED_EDITOR_WIDTH = 620;
export const DEFAULT_LIBRARY_RAIL_WIDTH = 180;

interface ResolveAssistantPresentationOptions {
  preference: AssistantPresentationPreference;
  manualOverride?: AssistantPresentation | null;
  viewportWidth: number;
  libraryRailOpen: boolean;
  sheetRailOpen: boolean;
  sheetRailWidth: number;
  inspectorWidth: number;
}

export function resolveAssistantPresentation({
  preference,
  manualOverride,
  viewportWidth,
  libraryRailOpen,
  sheetRailOpen,
  sheetRailWidth,
  inspectorWidth,
}: ResolveAssistantPresentationOptions): AssistantPresentation {
  if (manualOverride) return manualOverride;
  if (preference !== "auto") return preference;

  const projectedEditorWidth =
    viewportWidth - (libraryRailOpen ? DEFAULT_LIBRARY_RAIL_WIDTH : 0) - (sheetRailOpen ? sheetRailWidth : 0) - inspectorWidth;
  return projectedEditorWidth >= MIN_DOCKED_EDITOR_WIDTH ? "docked" : "floating";
}

export function normalizeAssistantPresentationPreference(value: unknown): AssistantPresentationPreference {
  return value === "floating" || value === "docked" ? value : DEFAULT_ASSISTANT_PRESENTATION_PREFERENCE;
}
