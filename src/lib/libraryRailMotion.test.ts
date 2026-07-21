import { describe, expect, it } from "vitest";
import {
  libraryRailMotionDirection,
  libraryRailMotionTransition,
  libraryRailSceneExit,
  libraryRailSceneInitial,
} from "./libraryRailMotion";

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
