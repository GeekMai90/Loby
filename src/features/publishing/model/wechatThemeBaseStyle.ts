/**
 * [INPUT]: 依赖 发布模块
 * [OUTPUT]: 对外提供 WechatThemeBaseStyleChange、applyWechatThemeBaseStyleChange
 * [POS]: 发布 feature 的领域模型边界，集中 发布 规则、数据转换与外部契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { WechatThemeBaseStyle, WechatThemeManifest } from "@/features/publishing/model/wechatThemes";

export type WechatThemeBaseStyleChange =
  | {
      group: "typography";
      key: keyof WechatThemeBaseStyle["typography"];
      value: number;
    }
  | {
      group: "colors";
      key: keyof WechatThemeBaseStyle["colors"];
      value: string;
    }
  | {
      group: "layout";
      key: keyof WechatThemeBaseStyle["layout"];
      value: number;
    };

export function applyWechatThemeBaseStyleChange(
  theme: WechatThemeManifest,
  change: WechatThemeBaseStyleChange,
  updatedAt = new Date().toISOString(),
): WechatThemeManifest {
  const baseStyle = cloneWechatThemeBaseStyle(theme.baseStyle);
  if (change.group === "typography") baseStyle.typography[change.key] = change.value;
  else if (change.group === "colors") baseStyle.colors[change.key] = change.value;
  else baseStyle.layout[change.key] = change.value;

  return {
    ...theme,
    swatches: [baseStyle.colors.accent, baseStyle.colors.titleText, baseStyle.colors.pageBackground],
    baseStyle,
    updatedAt,
  };
}

function cloneWechatThemeBaseStyle(baseStyle: WechatThemeBaseStyle): WechatThemeBaseStyle {
  return {
    typography: { ...baseStyle.typography },
    colors: { ...baseStyle.colors },
    layout: { ...baseStyle.layout },
  };
}
