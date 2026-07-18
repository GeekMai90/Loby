// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import {
  resolveSheetDragHoverIntent,
  resolveSheetMoveTarget,
  resolveSheetReorderTarget,
  sameSheetDragHoverIntent,
  sheetDragHoverDelay,
  SHEET_LIBRARY_RETURN_DELAY_MS,
  SHEET_PROJECT_OPEN_DELAY_MS,
} from "./sheetDrag";

describe("sheet drag targets", () => {
  it("resolves project hover and default-group drop from the same project row", () => {
    const project = document.createElement("button");
    project.dataset.sheetHoverProjectId = "project-blog";
    project.dataset.sheetMoveProjectId = "project-blog";
    const label = document.createElement("span");
    project.append(label);

    expect(resolveSheetDragHoverIntent(label)).toEqual({ kind: "project", projectId: "project-blog" });
    expect(resolveSheetMoveTarget(label)?.target).toEqual({ projectId: "project-blog", groupId: undefined });
  });

  it("resolves a concrete group without treating it as a project hover target", () => {
    const group = document.createElement("button");
    group.dataset.sheetMoveProjectId = "project-blog";
    group.dataset.sheetMoveGroupId = "group-published";

    expect(resolveSheetDragHoverIntent(group)).toBeNull();
    expect(resolveSheetMoveTarget(group)?.target).toEqual({ projectId: "project-blog", groupId: "group-published" });
  });

  it("uses the project title blank area to return to the library navigation", () => {
    const returnZone = document.createElement("div");
    returnZone.dataset.sheetDragReturnLibrary = "";

    expect(resolveSheetDragHoverIntent(returnZone)).toEqual({ kind: "library" });
    expect(sheetDragHoverDelay({ kind: "library" })).toBe(SHEET_LIBRARY_RETURN_DELAY_MS);
    expect(sheetDragHoverDelay({ kind: "project", projectId: "project-blog" })).toBe(SHEET_PROJECT_OPEN_DELAY_MS);
  });

  it("keeps an existing hover timer only for the same destination", () => {
    expect(sameSheetDragHoverIntent({ kind: "project", projectId: "a" }, { kind: "project", projectId: "a" })).toBe(true);
    expect(sameSheetDragHoverIntent({ kind: "project", projectId: "a" }, { kind: "project", projectId: "b" })).toBe(false);
    expect(sameSheetDragHoverIntent({ kind: "library" }, { kind: "library" })).toBe(true);
  });

  it("resolves list reorder position above and below the row midpoint", () => {
    const row = document.createElement("article");
    row.className = "sheet-row";
    row.dataset.sheetId = "target";
    row.getBoundingClientRect = () => ({
      x: 0,
      y: 100,
      top: 100,
      right: 200,
      bottom: 200,
      left: 0,
      width: 200,
      height: 100,
      toJSON: () => ({}),
    });

    expect(resolveSheetReorderTarget(row, "source", 130)?.target).toEqual({ sheetId: "target", position: "before" });
    expect(resolveSheetReorderTarget(row, "source", 170)?.target).toEqual({ sheetId: "target", position: "after" });
    expect(resolveSheetReorderTarget(row, "target", 130)).toBeNull();
  });
});
