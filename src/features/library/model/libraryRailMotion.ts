/**
 * [INPUT]: 依赖 motion/react 的动画契约与 shared 的 SidebarMode
 * [OUTPUT]: 对外提供导航场景方向、进退位移、时长与 Variants 配置
 * [POS]: 写作库 feature 的纯动效模型，为 LibraryRail 提供可逆层级过渡且不接触选择或持久化状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { Transition, Variants } from "motion/react";
import type { SidebarMode } from "@/shared/types";

export type LibraryRailMotionDirection = -1 | 0 | 1;

const LIBRARY_RAIL_MOTION_EASE = [0.22, 1, 0.36, 1] as const;

export function libraryRailMotionDirection(sidebarMode: SidebarMode, prefersReducedMotion: boolean | null) {
  if (prefersReducedMotion) return 0;
  return sidebarMode === "project" ? 1 : -1;
}

export function libraryRailSceneInitial(direction: LibraryRailMotionDirection) {
  return {
    opacity: 0,
    x: direction > 0 ? 22 : direction < 0 ? -16 : 0,
  };
}

export function libraryRailSceneExit(direction: LibraryRailMotionDirection) {
  return {
    opacity: 0,
    x: direction > 0 ? -16 : direction < 0 ? 22 : 0,
  };
}

export function libraryRailMotionTransition(prefersReducedMotion: boolean | null): Transition {
  return {
    duration: prefersReducedMotion ? 0.1 : 0.24,
    ease: LIBRARY_RAIL_MOTION_EASE,
  };
}

export const LIBRARY_RAIL_SCENE_VARIANTS = {
  initial: libraryRailSceneInitial,
  animate: { opacity: 1, x: 0 },
  exit: libraryRailSceneExit,
} satisfies Variants;
