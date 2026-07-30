/**
 * [INPUT]: 依赖 shared/types 的 MarkdownFormattingSettings 与不可信设置输入
 * [OUTPUT]: 对外提供 DEFAULT_MARKDOWN_FORMATTING_SETTINGS、normalizeMarkdownFormattingSettings
 * [POS]: 中文 Markdown 保存优化的默认策略与设置归一化边界，不执行正文格式化
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { MarkdownFormattingSettings } from "@/shared/types";

export const DEFAULT_MARKDOWN_FORMATTING_SETTINGS: MarkdownFormattingSettings = {
  formatOnSave: false,
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
    formatOnSave: normalizeBoolean(settings.formatOnSave, DEFAULT_MARKDOWN_FORMATTING_SETTINGS.formatOnSave),
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
