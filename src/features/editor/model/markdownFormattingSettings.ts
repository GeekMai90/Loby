/**
 * [INPUT]: 依赖 shared 公共契约
 * [OUTPUT]: 对外提供 DEFAULT_MARKDOWN_FORMATTING_SETTINGS、normalizeMarkdownFormattingSettings
 * [POS]: 编辑器 feature 的领域模型边界，集中 编辑器 规则、数据转换与外部契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { MarkdownFormattingSettings } from "@/shared/types";

export const DEFAULT_MARKDOWN_FORMATTING_SETTINGS: MarkdownFormattingSettings = {
  cleanupWhitespace: true,
  normalizeBlockSpacing: true,
  normalizeMarkdownMarkers: true,
  spaceCjkAndLatin: true,
  fullWidthPunctuation: true,
};

export function normalizeMarkdownFormattingSettings(value: unknown): MarkdownFormattingSettings {
  if (!value || typeof value !== "object") return { ...DEFAULT_MARKDOWN_FORMATTING_SETTINGS };
  const settings = value as Partial<MarkdownFormattingSettings>;
  return {
    cleanupWhitespace: normalizeBoolean(settings.cleanupWhitespace, DEFAULT_MARKDOWN_FORMATTING_SETTINGS.cleanupWhitespace),
    normalizeBlockSpacing: normalizeBoolean(settings.normalizeBlockSpacing, DEFAULT_MARKDOWN_FORMATTING_SETTINGS.normalizeBlockSpacing),
    normalizeMarkdownMarkers: normalizeBoolean(
      settings.normalizeMarkdownMarkers,
      DEFAULT_MARKDOWN_FORMATTING_SETTINGS.normalizeMarkdownMarkers,
    ),
    spaceCjkAndLatin: normalizeBoolean(settings.spaceCjkAndLatin, DEFAULT_MARKDOWN_FORMATTING_SETTINGS.spaceCjkAndLatin),
    fullWidthPunctuation: normalizeBoolean(settings.fullWidthPunctuation, DEFAULT_MARKDOWN_FORMATTING_SETTINGS.fullWidthPunctuation),
  };
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}
