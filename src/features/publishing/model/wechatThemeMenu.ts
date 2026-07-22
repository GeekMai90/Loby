/**
 * [INPUT]: 依赖 发布模块
 * [OUTPUT]: 对外提供 WechatThemeMenuAction、getWechatThemeMenuActions
 * [POS]: 发布 feature 的领域模型边界，集中 发布 规则、数据转换与外部契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { WechatThemeManifest } from "@/features/publishing/model/wechatThemes";

export type WechatThemeMenuAction = "duplicate" | "export" | "rename" | "delete";

export function getWechatThemeMenuActions(theme: WechatThemeManifest): WechatThemeMenuAction[] {
  return theme.kind === "built-in" ? ["duplicate", "export"] : ["duplicate", "export", "rename", "delete"];
}
