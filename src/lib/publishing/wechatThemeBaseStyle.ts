import type { WechatThemeBaseStyle, WechatThemeManifest } from "./wechatThemes";

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
