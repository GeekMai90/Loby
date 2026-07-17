export type WechatThemePreviewViewport = "mobile" | "desktop";

export const WECHAT_THEME_PREVIEW_FRAMES = {
  mobile: { label: "手机", status: "手机端预览", width: 402, height: 874 },
  desktop: { label: "电脑", status: "电脑端预览", width: 820, height: 760 },
} as const satisfies Record<WechatThemePreviewViewport, { label: string; status: string; width: number; height: number }>;

const PREVIEW_AREA_VERTICAL_PADDING = 88;

export function resolveWechatThemePreviewHeight(areaHeight: number, zoom: number, fallbackHeight: number): number {
  if (!Number.isFinite(areaHeight) || !Number.isFinite(zoom) || areaHeight <= 0 || zoom <= 0) return fallbackHeight;
  return Math.max(1, Math.floor((areaHeight - PREVIEW_AREA_VERTICAL_PADDING) / zoom));
}
