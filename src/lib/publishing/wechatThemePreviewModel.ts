export type WechatThemePreviewViewport = "mobile" | "desktop";

export const WECHAT_THEME_PREVIEW_FRAMES = {
  mobile: { label: "手机", status: "手机端预览", width: 390, height: 760 },
  desktop: { label: "电脑", status: "电脑端预览", width: 820, height: 760 },
} as const satisfies Record<WechatThemePreviewViewport, { label: string; status: string; width: number; height: number }>;

const PREVIEW_AREA_VERTICAL_PADDING = 48;

export function resolveWechatThemePreviewHeight(areaHeight: number, zoom: number, minimumHeight: number): number {
  if (!Number.isFinite(areaHeight) || !Number.isFinite(zoom) || areaHeight <= 0 || zoom <= 0) return minimumHeight;
  return Math.max(minimumHeight, Math.floor((areaHeight - PREVIEW_AREA_VERTICAL_PADDING) / zoom));
}
