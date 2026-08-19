/**
 * [INPUT]: 依赖 UnsplashPhoto 的原始宽高、目标裁剪比例与归一化焦点
 * [OUTPUT]: 对外提供 CropAspect、CropGeometry、缩放边界与裁剪构造函数，统一预览和 native crop 使用的取景几何
 * [POS]: media feature 的纯数据模型；不依赖 React，不处理指针事件、下载或正文插入
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { UnsplashCrop, UnsplashPhoto } from "@/features/media/model/unsplash";

export interface CropAspect {
  width: number;
  height: number;
  label: string;
}

export interface CropGeometry {
  imageWidth: number;
  imageHeight: number;
  imageLeft: number;
  imageTop: number;
  cropWidth: number;
  cropHeight: number;
  cropLeft: number;
  cropTop: number;
  extraX: number;
  extraY: number;
  canPanX: boolean;
  canPanY: boolean;
}

const CROP_STAGE_ASPECT = 16 / 9;
const CROP_FRAME_INSET = 4;
export const CROP_ZOOM_MIN = 1;
export const CROP_ZOOM_MAX = 2.5;
export const CROP_ZOOM_DEFAULT = 1.1;

export function resolveCropGeometry(
  photo: Pick<UnsplashPhoto, "width" | "height">,
  aspect: CropAspect,
  focusX: number,
  focusY: number,
  zoom = CROP_ZOOM_DEFAULT,
): CropGeometry {
  const sourceRatio = photo.width > 0 && photo.height > 0 ? photo.width / photo.height : CROP_STAGE_ASPECT;
  const targetRatio = aspect.width > 0 && aspect.height > 0 ? aspect.width / aspect.height : CROP_STAGE_ASPECT;
  const innerSize = 100 - CROP_FRAME_INSET * 2;
  const cropWidth = targetRatio >= CROP_STAGE_ASPECT ? innerSize : (targetRatio / CROP_STAGE_ASPECT) * innerSize;
  const cropHeight = targetRatio >= CROP_STAGE_ASPECT ? (CROP_STAGE_ASPECT / targetRatio) * innerSize : innerSize;
  const cropLeft = (100 - cropWidth) / 2;
  const cropTop = (100 - cropHeight) / 2;
  const sourceCrop = resolveCropSourceWindow(sourceRatio, targetRatio, zoom);
  const imageWidth = cropWidth / sourceCrop.width;
  const imageHeight = cropHeight / sourceCrop.height;
  const extraX = Math.max(0, imageWidth - cropWidth);
  const extraY = Math.max(0, imageHeight - cropHeight);
  const imageLeft = cropLeft - extraX * clamp(focusX);
  const imageTop = cropTop - extraY * clamp(focusY);

  return {
    imageWidth,
    imageHeight,
    imageLeft,
    imageTop,
    cropWidth,
    cropHeight,
    cropLeft,
    cropTop,
    extraX,
    extraY,
    canPanX: extraX > 0.0001,
    canPanY: extraY > 0.0001,
  };
}

export function buildUnsplashCrop(
  photo: Pick<UnsplashPhoto, "width" | "height">,
  aspect: CropAspect,
  focusX: number,
  focusY: number,
  zoom = CROP_ZOOM_DEFAULT,
): UnsplashCrop | null {
  if (photo.width <= 0 || photo.height <= 0) return null;

  const sourceRatio = photo.width / photo.height;
  const targetRatio = aspect.width > 0 && aspect.height > 0 ? aspect.width / aspect.height : CROP_STAGE_ASPECT;
  const sourceCrop = resolveCropSourceWindow(sourceRatio, targetRatio, zoom);

  return {
    x: (1 - sourceCrop.width) * clamp(focusX),
    y: (1 - sourceCrop.height) * clamp(focusY),
    width: sourceCrop.width,
    height: sourceCrop.height,
    aspectWidth: aspect.width,
    aspectHeight: aspect.height,
  };
}

function resolveCropSourceWindow(sourceRatio: number, targetRatio: number, zoom: number): { width: number; height: number } {
  const baseWidth = sourceRatio >= targetRatio ? targetRatio / sourceRatio : 1;
  const baseHeight = sourceRatio >= targetRatio ? 1 : sourceRatio / targetRatio;
  const safeZoom = clampCropZoom(zoom);
  return {
    width: baseWidth / safeZoom,
    height: baseHeight / safeZoom,
  };
}

export function clampCropZoom(value: number): number {
  if (!Number.isFinite(value)) return CROP_ZOOM_DEFAULT;
  return Math.min(CROP_ZOOM_MAX, Math.max(CROP_ZOOM_MIN, value));
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}
