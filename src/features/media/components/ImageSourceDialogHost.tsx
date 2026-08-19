/**
 * [INPUT]: 依赖 ImageSourceDialog 的公开 props 与 React lazy/Suspense
 * [OUTPUT]: 对外提供 ImageSourceDialogHost，将图片来源与裁剪 surface 的按需加载边界保留在 media feature
 * [POS]: media feature 的图片来源 surface host；不拥有图片导入、正文写回或 Unsplash 请求状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { lazy, Suspense } from "react";
import type { ImageSourceDialogProps } from "@/features/media/components/ImageSourceDialog";

const ImageSourceDialog = lazy(() =>
  import("@/features/media/components/ImageSourceDialog").then((module) => ({ default: module.ImageSourceDialog })),
);

export type ImageSourceDialogHostProps = ImageSourceDialogProps;

export function ImageSourceDialogHost(props: ImageSourceDialogHostProps) {
  if (!props.open) return null;
  return (
    <Suspense fallback={null}>
      <ImageSourceDialog {...props} />
    </Suspense>
  );
}
