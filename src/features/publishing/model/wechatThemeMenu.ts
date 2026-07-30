/**
 * [INPUT]: 依赖 WechatThemeManifest 的 built-in/personal 所有权标识
 * [OUTPUT]: 对外提供 WechatThemeMenuAction、getWechatThemeMenuActions
 * [POS]: 公众号主题更多菜单的权限策略层，阻止内置主题出现重命名或删除动作
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { WechatThemeManifest } from "@/features/publishing/model/wechatThemes";

export type WechatThemeMenuAction = "duplicate" | "export" | "rename" | "delete";

export function getWechatThemeMenuActions(theme: WechatThemeManifest): WechatThemeMenuAction[] {
  return theme.kind === "built-in" ? ["duplicate", "export"] : ["duplicate", "export", "rename", "delete"];
}
