import { describe, expect, it } from "vitest";
import {
  allExportSheetIds,
  getSelectedExportSheets,
  moveExportSheetId,
  pruneExportSelection,
  toggleExportSheetId,
} from "@/features/publishing/model/exportSelection";
import type { WritingSheet } from "@/shared/types";

const publishableSheets = [sheet("intro", "开头"), sheet("body", "正文"), sheet("ending", "结尾")];

describe("exportSelection", () => {
  it("selects all publishable sheet ids in publish order", () => {
    expect(allExportSheetIds(publishableSheets)).toEqual(["intro", "body", "ending"]);
  });

  it("resolves selected sheets while ignoring stale ids", () => {
    expect(getSelectedExportSheets(publishableSheets, ["ending", "missing", "intro"]).map((item) => item.id)).toEqual(["ending", "intro"]);
  });

  it("prunes stale ids when publishable sheets change", () => {
    expect(pruneExportSelection(["intro", "deleted", "body"], publishableSheets)).toEqual(["intro", "body"]);
  });

  it("toggles ids without reordering existing selections", () => {
    expect(toggleExportSheetId(["intro", "body"], "intro")).toEqual(["body"]);
    expect(toggleExportSheetId(["intro"], "ending")).toEqual(["intro", "ending"]);
  });

  it("moves selected ids within bounds", () => {
    expect(moveExportSheetId(["intro", "body", "ending"], "body", -1)).toEqual(["body", "intro", "ending"]);
    expect(moveExportSheetId(["intro", "body", "ending"], "body", 1)).toEqual(["intro", "ending", "body"]);
    expect(moveExportSheetId(["intro", "body", "ending"], "intro", -1)).toEqual(["intro", "body", "ending"]);
    expect(moveExportSheetId(["intro", "body", "ending"], "missing", 1)).toEqual(["intro", "body", "ending"]);
  });
});

function sheet(id: string, title: string): WritingSheet {
  return {
    id,
    title,
    groupId: "group-main",
    status: "构思",
    targetWords: 1000,
    summary: "",
    body: title,
    updatedAt: "2026-07-09",
  };
}
