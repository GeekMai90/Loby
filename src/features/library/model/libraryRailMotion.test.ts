/**
 * [INPUT]: 依赖 Vitest 与 libraryRailMotion 的纯动效模型
 * [OUTPUT]: 验证进入、返回与 reduced-motion 三种导航场景契约
 * [POS]: 写作库 feature 的动效回归测试，防止层级方向和无障碍降级被后续重构破坏
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { describe, expect, it } from "vitest";
import {
  libraryRailMotionDirection,
  libraryRailMotionTransition,
  libraryRailSceneExit,
  libraryRailSceneInitial,
} from "@/features/library/model/libraryRailMotion";

describe("library rail motion", () => {
  it("pushes forward when entering a project", () => {
    const direction = libraryRailMotionDirection("project", false);

    expect(direction).toBe(1);
    expect(libraryRailSceneInitial(direction)).toEqual({ opacity: 0, x: 22 });
    expect(libraryRailSceneExit(direction)).toEqual({ opacity: 0, x: -16 });
  });

  it("reverses the motion when returning to the library", () => {
    const direction = libraryRailMotionDirection("library", false);

    expect(direction).toBe(-1);
    expect(libraryRailSceneInitial(direction)).toEqual({ opacity: 0, x: -16 });
    expect(libraryRailSceneExit(direction)).toEqual({ opacity: 0, x: 22 });
  });

  it("keeps only a short fade when reduced motion is preferred", () => {
    const direction = libraryRailMotionDirection("project", true);

    expect(direction).toBe(0);
    expect(libraryRailSceneInitial(direction)).toEqual({ opacity: 0, x: 0 });
    expect(libraryRailSceneExit(direction)).toEqual({ opacity: 0, x: 0 });
    expect(libraryRailMotionTransition(true)).toMatchObject({ duration: 0.1 });
  });
});
