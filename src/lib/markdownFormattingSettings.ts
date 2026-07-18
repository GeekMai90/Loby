import type { MarkdownFormattingSettings } from "../types";

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
