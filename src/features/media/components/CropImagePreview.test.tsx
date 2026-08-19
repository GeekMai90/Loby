/**
 * [INPUT]: 依赖 CropImagePreview 的裁剪几何计算与 CropAspect 契约
 * [OUTPUT]: 验证不同原图/裁剪比例下的取景范围和可拖动方向，防止预览与最终 native crop 脱节
 * [POS]: media components 的裁剪几何回归测试；不测试浏览器指针事件的具体实现
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { describe, expect, it } from "vitest";
import {
  buildUnsplashCrop,
  clampCropZoom,
  CROP_ZOOM_DEFAULT,
  CROP_ZOOM_MAX,
  CROP_ZOOM_MIN,
  resolveCropGeometry,
  type CropAspect,
} from "@/features/media/model/crop";

const WIDE_ASPECT: CropAspect = { width: 16, height: 9, label: "16:9" };

describe("resolveCropGeometry", () => {
  it("fills the crop viewport with a wide source and allows centered movement", () => {
    const geometry = resolveCropGeometry({ width: 2400, height: 1200 }, WIDE_ASPECT, 0.5, 0.5);

    expect(geometry.canPanX).toBe(true);
    expect(geometry.canPanY).toBe(true);
    expect(geometry.imageLeft).toBeCloseTo(-6.925);
    expect(geometry.imageTop).toBeCloseTo(-0.6);
  });

  it("allows movement in both directions after the default center zoom", () => {
    const geometry = resolveCropGeometry({ width: 1200, height: 2400 }, WIDE_ASPECT, 0.5, 0.5);

    expect(geometry.canPanX).toBe(true);
    expect(geometry.canPanY).toBe(true);
    expect(geometry.imageLeft).toBeCloseTo(-0.6);
    expect(geometry.imageTop).toBeCloseTo(-129.9111);
  });

  it("keeps a centered crop frame when source and crop ratios are the same", () => {
    const geometry = resolveCropGeometry({ width: 1600, height: 900 }, WIDE_ASPECT, 0.5, 0.5);

    expect(geometry.canPanX).toBe(true);
    expect(geometry.canPanY).toBe(true);
    expect(geometry.cropWidth).toBeCloseTo(92);
    expect(geometry.cropHeight).toBeCloseTo(92);
    expect(geometry.cropLeft).toBeCloseTo(4);
    expect(geometry.cropTop).toBeCloseTo(4);
  });

  it("keeps a 4:3 photo filled behind the 16:9 crop frame", () => {
    const geometry = resolveCropGeometry({ width: 1600, height: 1200 }, WIDE_ASPECT, 0.5, 0.5);

    expect(geometry.imageWidth).toBeCloseTo(101.2);
    expect(geometry.imageHeight).toBeCloseTo(134.9333);
    expect(geometry.imageLeft).toBeCloseTo(-0.6);
    expect(geometry.canPanX).toBe(true);
    expect(geometry.canPanY).toBe(true);
  });

  it("uses the same centered zoom window for the final native crop", () => {
    const crop = buildUnsplashCrop({ width: 1600, height: 1200 }, WIDE_ASPECT, 0.5, 0.5);

    expect(crop).not.toBeNull();
    expect(crop?.x).toBeCloseTo(0.04545);
    expect(crop?.y).toBeCloseTo(0.15909);
    expect(crop?.width).toBeCloseTo(0.90909);
    expect(crop?.height).toBeCloseTo(0.68182);
  });

  it("keeps gesture zoom inside the safe source-image range", () => {
    expect(clampCropZoom(0.2)).toBe(CROP_ZOOM_MIN);
    expect(clampCropZoom(4)).toBe(CROP_ZOOM_MAX);
    expect(clampCropZoom(Number.NaN)).toBe(CROP_ZOOM_DEFAULT);

    const crop = buildUnsplashCrop({ width: 1600, height: 1200 }, WIDE_ASPECT, 0.5, 0.5, CROP_ZOOM_MAX);
    expect(crop?.width).toBeCloseTo(0.4);
    expect(crop?.height).toBeCloseTo(0.3);
  });

  it("keeps preview geometry and native crop aligned after zooming", () => {
    const geometry = resolveCropGeometry({ width: 1600, height: 1200 }, WIDE_ASPECT, 0.5, 0.5, 2);
    const crop = buildUnsplashCrop({ width: 1600, height: 1200 }, WIDE_ASPECT, 0.5, 0.5, 2);

    expect(crop?.width).toBeCloseTo(92 / geometry.imageWidth);
    expect(crop?.height).toBeCloseTo(92 / geometry.imageHeight);
    expect(crop?.x).toBeCloseTo((1 - (crop?.width ?? 0)) / 2);
    expect(crop?.y).toBeCloseTo((1 - (crop?.height ?? 0)) / 2);
  });
});
