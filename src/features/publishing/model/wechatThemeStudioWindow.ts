/**
 * [INPUT]: 依赖 同目录稳定契约
 * [OUTPUT]: 对外提供 isWechatThemeStudioWindow
 * [POS]: 发布 feature 的领域模型边界，集中 发布 规则、数据转换与外部契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
export function isWechatThemeStudioWindow(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("window") === "wechat-theme-studio";
}
