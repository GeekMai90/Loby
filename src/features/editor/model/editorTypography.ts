/**
 * [INPUT]: 依赖 React 运行时、shared 公共契约
 * [OUTPUT]: 对外提供 createEditorTypographyStyle、resolveEditorFontFamily
 * [POS]: 编辑器 feature 的领域模型边界，集中 编辑器 规则、数据转换与外部契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { CSSProperties } from "react";
import type { EditorTypographySettings } from "@/shared/types";

export function createEditorTypographyStyle(typography: EditorTypographySettings): CSSProperties {
  return {
    "--editor-font-family": resolveEditorFontFamily(typography),
    "--editor-line-height": String(typography.lineHeight),
    "--editor-paragraph-spacing": `${typography.paragraphSpacing}px`,
    "--editor-body-font-size": `${typography.bodyFontSize}px`,
    "--editor-h1-font-size": `${typography.h1FontSize}px`,
    "--editor-h2-font-size": `${typography.h2FontSize}px`,
    "--editor-h3-font-size": `${typography.h3FontSize}px`,
    "--editor-table-font-size": `${typography.tableFontSize}px`,
  } as CSSProperties;
}

export function resolveEditorFontFamily(typography: EditorTypographySettings): string {
  if (typography.fontPreset === "pingfang") return "'PingFang SC', 'SF Pro Text', sans-serif";
  if (typography.fontPreset === "songti") return "'Songti SC', 'STSong', 'SimSun', serif";
  if (typography.fontPreset === "kaiti") return "'Kaiti SC', 'STKaiti', KaiTi, serif";
  if (typography.fontPreset === "lxgw-wenkai") return "'LXGW WenKai', 'LXGW WenKai SC', '霞鹜文楷', '霞鹜文楷 GB', serif";
  if (typography.fontPreset === "huiwen-mincho") return "'Huiwen-mincho', 'Huiwen Mincho', '汇文明朝体', '汇文明朝', serif";
  if (typography.fontPreset === "mono") return "'SF Mono', 'SFMono-Regular', Menlo, Consolas, monospace";
  if (typography.fontPreset === "custom" && typography.customFontFamily.trim()) {
    return typography.customFontFamily.trim();
  }
  return "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', 'Microsoft YaHei', sans-serif";
}
