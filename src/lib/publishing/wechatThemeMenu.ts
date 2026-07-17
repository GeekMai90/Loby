import type { WechatThemeManifest } from "./wechatThemes";

export type WechatThemeMenuAction = "duplicate" | "export" | "rename" | "delete";

export function getWechatThemeMenuActions(theme: WechatThemeManifest): WechatThemeMenuAction[] {
  return theme.kind === "built-in" ? ["duplicate", "export"] : ["duplicate", "export", "rename", "delete"];
}
