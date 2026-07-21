import type { Transition, Variants } from "motion/react";
import type { SidebarMode } from "../types";

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
