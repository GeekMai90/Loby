export function isWechatThemeStudioWindow(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("window") === "wechat-theme-studio";
}
