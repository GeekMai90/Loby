/**
 * [INPUT]: 依赖 wechatThemes 的基础样式与完整主题 manifest 契约
 * [OUTPUT]: 对外提供 WechatThemeBaseStyleChange、applyWechatThemeBaseStyleChange
 * [POS]: 公众号主题基础样式的不可变 patch 应用层，只修改 typography/colors/layout 中一个合法字段
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
