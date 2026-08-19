/**
 * [INPUT]: 依赖 React lazy、编辑器画布与仅开发环境启用的设计画廊动态 import
 * [OUTPUT]: 对外提供编辑器画布预加载/按需加载边界，以及开发环境设计画廊 surface
 * [POS]: app 组合层保留的首屏 code-splitting registry；feature-specific 弹窗与面板由所属模块自行声明加载边界
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { lazy } from "react";

export const loadEditorCanvas = () =>
  import("@/features/editor/components/EditorCanvas").then((module) => ({ default: module.EditorCanvas }));
export const EditorCanvas = lazy(loadEditorCanvas);

export const DesignGallery = import.meta.env.DEV
  ? lazy(() => import("@/features/design-gallery/components/DesignGallery").then((module) => ({ default: module.DesignGallery })))
  : null;
export const ColorSystemGallery = import.meta.env.DEV
  ? lazy(() =>
      import("@/features/design-gallery/components/ColorSystemGallery").then((module) => ({
        default: module.ColorSystemGallery,
      })),
    )
  : null;
