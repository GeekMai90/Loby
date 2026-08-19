/**
 * [INPUT]: 依赖 UnsplashPhoto 的原始尺寸/预览地址与裁剪比例，接收父级提供的归一化焦点、缩放值和九宫格状态
 * [OUTPUT]: 对外提供横版裁剪画布组件，负责黑色预览底色、图片遮罩、折角取景框、拖动取景、Mac 触控板/滚轮缩放和九宫格显隐
 * [POS]: media feature 的裁剪交互边界；只把像素拖动转换为 focusX/focusY，不负责下载、裁剪落盘或正文插入
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { clampCropZoom, resolveCropGeometry, type CropAspect } from "@/features/media/model/crop";
import type { UnsplashPhoto } from "@/features/media/model/unsplash";
import { cn } from "@/shared/lib/utils";
import { useEffect, useRef, useState, type PointerEvent, type WheelEvent } from "react";

interface CropImagePreviewProps {
  photo: UnsplashPhoto;
  aspect: CropAspect;
  focusX: number;
  focusY: number;
  zoom: number;
  gridVisible: boolean;
  onFocusXChange: (value: number) => void;
  onFocusYChange: (value: number) => void;
  onZoomChange: (value: number) => void;
  onGridVisibleChange: (visible: boolean) => void;
  className?: string;
}

interface PointerPosition {
  pointerId: number;
  x: number;
  y: number;
}

interface MacGesture {
  zoom: number;
}

interface MacGestureEvent extends Event {
  scale?: number;
}

export function CropImagePreview({
  photo,
  aspect,
  focusX,
  focusY,
  zoom,
  gridVisible,
  onFocusXChange,
  onFocusYChange,
  onZoomChange,
  onGridVisibleChange,
  className,
}: CropImagePreviewProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<PointerPosition | null>(null);
  const gestureRef = useRef<MacGesture | null>(null);
  const focusRef = useRef({ x: focusX, y: focusY });
  const zoomRef = useRef(zoom);
  const [dragging, setDragging] = useState(false);
  const geometry = resolveCropGeometry(photo, aspect, focusX, focusY, zoom);

  useEffect(() => {
    focusRef.current = { x: focusX, y: focusY };
  }, [focusX, focusY]);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    const element = previewRef.current;
    if (!element) return;

    function handleGestureStart(event: Event) {
      event.preventDefault();
      gestureRef.current = { zoom: zoomRef.current };
      onGridVisibleChange(true);
    }

    function handleGestureChange(event: Event) {
      event.preventDefault();
      const gesture = gestureRef.current;
      if (!gesture) return;
      const scale = (event as MacGestureEvent).scale;
      if (!scale || !Number.isFinite(scale)) return;
      onZoomChange(clampCropZoom(gesture.zoom * scale));
      onGridVisibleChange(true);
    }

    function handleGestureEnd(event: Event) {
      event.preventDefault();
      gestureRef.current = null;
    }

    element.addEventListener("gesturestart", handleGestureStart, { passive: false });
    element.addEventListener("gesturechange", handleGestureChange, { passive: false });
    element.addEventListener("gestureend", handleGestureEnd, { passive: false });
    return () => {
      element.removeEventListener("gesturestart", handleGestureStart);
      element.removeEventListener("gesturechange", handleGestureChange);
      element.removeEventListener("gestureend", handleGestureEnd);
    };
  }, [onGridVisibleChange, onZoomChange]);

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    onGridVisibleChange(true);
    if (!geometry.canPanX && !geometry.canPanY) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    pointerRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    setDragging(true);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const pointer = pointerRef.current;
    if (!pointer || pointer.pointerId !== event.pointerId) return;

    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const deltaX = event.clientX - pointer.x;
    const deltaY = event.clientY - pointer.y;
    pointerRef.current = { pointerId: pointer.pointerId, x: event.clientX, y: event.clientY };

    if (geometry.canPanX) {
      const nextFocusX = clamp(focusRef.current.x - deltaX / (rect.width * (geometry.extraX / 100)));
      focusRef.current.x = nextFocusX;
      onFocusXChange(nextFocusX);
    }
    if (geometry.canPanY) {
      const nextFocusY = clamp(focusRef.current.y - deltaY / (rect.height * (geometry.extraY / 100)));
      focusRef.current.y = nextFocusY;
      onFocusYChange(nextFocusY);
    }
  }

  function finishPointer(event: PointerEvent<HTMLDivElement>, hideWhenOutside: boolean) {
    const pointer = pointerRef.current;
    if (!pointer || pointer.pointerId !== event.pointerId) {
      setDragging(false);
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    pointerRef.current = null;
    setDragging(false);

    if (hideWhenOutside) {
      const rect = event.currentTarget.getBoundingClientRect();
      const isOutside = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
      if (isOutside) onGridVisibleChange(false);
    }
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    finishPointer(event, true);
  }

  function handlePointerCancel(event: PointerEvent<HTMLDivElement>) {
    finishPointer(event, false);
    onGridVisibleChange(false);
  }

  function handlePointerLeave() {
    if (!pointerRef.current && !gestureRef.current) onGridVisibleChange(false);
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    if (event.deltaY === 0) return;
    if (gestureRef.current) return;

    const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
    const nextZoom = clampCropZoom(zoomRef.current * Math.exp(-delta * 0.002));
    zoomRef.current = nextZoom;
    onZoomChange(nextZoom);
    onGridVisibleChange(true);
  }

  const imageStyle = {
    left: `${geometry.imageLeft}%`,
    top: `${geometry.imageTop}%`,
    width: `${geometry.imageWidth}%`,
    height: `${geometry.imageHeight}%`,
  };
  const cropStyle = {
    left: `${geometry.cropLeft}%`,
    top: `${geometry.cropTop}%`,
    width: `${geometry.cropWidth}%`,
    height: `${geometry.cropHeight}%`,
  };
  const canPan = geometry.canPanX || geometry.canPanY;

  return (
    <div
      ref={previewRef}
      className={cn(
        "relative isolate aspect-video w-full overflow-hidden rounded-xl bg-foreground select-none touch-none",
        dragging ? "cursor-grabbing" : canPan ? "cursor-grab" : "cursor-default",
        className,
      )}
      aria-label="拖动图片调整裁剪位置，使用滚轮或 Mac 触控板捏合调整缩放"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={handlePointerLeave}
      onWheel={handleWheel}
    >
      <img
        src={photo.urls.regular || photo.urls.raw}
        alt={photo.description.trim() || photo.altDescription.trim() || "待裁剪图片"}
        className="pointer-events-none absolute block max-w-none object-fill"
        draggable={false}
        style={imageStyle}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 bg-scrim-crop" style={{ height: `${geometry.cropTop}%` }} />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 bg-scrim-crop"
        style={{ height: `${Math.max(0, 100 - geometry.cropTop - geometry.cropHeight)}%` }}
      />
      <div
        className="pointer-events-none absolute left-0 bg-scrim-crop"
        style={{ top: `${geometry.cropTop}%`, width: `${geometry.cropLeft}%`, height: `${geometry.cropHeight}%` }}
      />
      <div
        className="pointer-events-none absolute right-0 bg-scrim-crop"
        style={{
          top: `${geometry.cropTop}%`,
          width: `${Math.max(0, 100 - geometry.cropLeft - geometry.cropWidth)}%`,
          height: `${geometry.cropHeight}%`,
        }}
      />

      <div className="pointer-events-none absolute border border-primary-foreground/80" style={cropStyle}>
        <span className="absolute -top-1 -left-1 size-7 border-t-[3px] border-l-[3px] border-primary-foreground" />
        <span className="absolute -top-1 -right-1 size-7 border-t-[3px] border-r-[3px] border-primary-foreground" />
        <span className="absolute -bottom-1 -left-1 size-7 border-b-[3px] border-l-[3px] border-primary-foreground" />
        <span className="absolute -right-1 -bottom-1 size-7 border-r-[3px] border-b-[3px] border-primary-foreground" />
        {gridVisible && (
          <div className="absolute inset-0">
            <span className="absolute inset-y-0 left-1/3 border-l border-primary-foreground/55" />
            <span className="absolute inset-y-0 left-2/3 border-l border-primary-foreground/55" />
            <span className="absolute inset-x-0 top-1/3 border-t border-primary-foreground/55" />
            <span className="absolute inset-x-0 top-2/3 border-t border-primary-foreground/55" />
          </div>
        )}
      </div>
    </div>
  );
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}
