/**
 * [INPUT]: 依赖 同目录稳定契约
 * [OUTPUT]: 对外提供 WechatThemePreviewViewport、WECHAT_THEME_PREVIEW_FRAMES、WECHAT_MOBILE_DEVICE_FRAME、resolveWechatThemePreviewHeight、resolveWechatMobileDeviceScale
 * [POS]: 发布 feature 的领域模型边界，集中 发布 规则、数据转换与外部契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
export type WechatThemePreviewViewport = "mobile" | "desktop";

export const WECHAT_THEME_PREVIEW_FRAMES = {
  mobile: { label: "手机", status: "iPhone 17 Pro 预览", width: 402, height: 874 },
  desktop: { label: "电脑", status: "电脑端预览", width: 677, height: 760 },
} as const satisfies Record<WechatThemePreviewViewport, { label: string; status: string; width: number; height: number }>;

export const WECHAT_MOBILE_DEVICE_FRAME = {
  sourceWidth: 1406,
  sourceHeight: 2822,
  sourceScreenLeft: 101,
  sourceScreenTop: 100,
  sourceScreenWidth: 1206,
  sourceScreenHeight: 2622,
  sourceScale: 1 / 3,
  safeAreaTop: 64,
  safeAreaBottom: 32,
} as const;

const PREVIEW_AREA_HORIZONTAL_PADDING = 48;
const PREVIEW_DEVICE_VERTICAL_RESERVE = 48;

export function resolveWechatThemePreviewHeight(areaHeight: number, zoom: number, fallbackHeight: number): number {
  if (!Number.isFinite(areaHeight) || !Number.isFinite(zoom) || areaHeight <= 0 || zoom <= 0) return fallbackHeight;
  return Math.max(1, Math.floor((areaHeight - PREVIEW_DEVICE_VERTICAL_RESERVE) / zoom));
}

export function resolveWechatMobileDeviceScale(areaWidth: number, areaHeight: number): number {
  return resolveWechatDeviceScale(
    areaWidth,
    areaHeight,
    WECHAT_MOBILE_DEVICE_FRAME.sourceWidth * WECHAT_MOBILE_DEVICE_FRAME.sourceScale,
    WECHAT_MOBILE_DEVICE_FRAME.sourceHeight * WECHAT_MOBILE_DEVICE_FRAME.sourceScale,
  );
}

function resolveWechatDeviceScale(areaWidth: number, areaHeight: number, frameWidth: number, frameHeight: number): number {
  if (!Number.isFinite(areaWidth) || !Number.isFinite(areaHeight) || areaWidth <= 0 || areaHeight <= 0) return 1;
  const availableWidth = Math.max(1, areaWidth - PREVIEW_AREA_HORIZONTAL_PADDING);
  const availableHeight = Math.max(1, areaHeight - PREVIEW_DEVICE_VERTICAL_RESERVE);
  return Math.max(0.1, Math.min(1, availableWidth / frameWidth, availableHeight / frameHeight));
}
