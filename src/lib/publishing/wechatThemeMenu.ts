import type { WechatThemeManifest } from "./wechatThemes";

export type WechatThemeMenuAction = "duplicate" | "rename" | "delete";

export function getWechatThemeMenuActions(theme: WechatThemeManifest): WechatThemeMenuAction[] {
  return theme.kind === "built-in" ? ["duplicate"] : ["duplicate", "rename", "delete"];
}
