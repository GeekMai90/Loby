import { describe, expect, it } from "vitest";
import {
  pruneSheetSelection,
  resolveContextSheetSelection,
  resolveFirstRemainingSheetId,
  resolveSheetSelection,
} from "@/features/library/model/sheetSelection";

const visibleSheetIds = ["one", "two", "three", "four"];
const noModifiers = { metaKey: false, ctrlKey: false, shiftKey: false };

describe("sheetSelection", () => {
  it("replaces the selection for an ordinary click", () => {
    expect(
      resolveSheetSelection({
        selectedSheetIds: ["one", "two"],
        anchorSheetId: "one",
        visibleSheetIds,
        sheetId: "three",
        modifiers: noModifiers,
      }),
    ).toEqual({ selectedSheetIds: ["three"], anchorSheetId: "three" });
  });

  it("toggles sheets with the platform modifier", () => {
    const added = resolveSheetSelection({
      selectedSheetIds: ["one"],
      anchorSheetId: "one",
      visibleSheetIds,
      sheetId: "three",
      modifiers: { ...noModifiers, metaKey: true },
    });
    expect(added).toEqual({ selectedSheetIds: ["one", "three"], anchorSheetId: "three" });

    expect(
      resolveSheetSelection({
        selectedSheetIds: added.selectedSheetIds,
        anchorSheetId: added.anchorSheetId,
        visibleSheetIds,
        sheetId: "one",
        modifiers: { ...noModifiers, ctrlKey: true },
      }),
    ).toEqual({ selectedSheetIds: ["three"], anchorSheetId: "one" });
  });

  it("selects a contiguous range from the current anchor", () => {
    expect(
      resolveSheetSelection({
        selectedSheetIds: ["one"],
        anchorSheetId: "one",
        visibleSheetIds,
        sheetId: "three",
        modifiers: { ...noModifiers, shiftKey: true },
      }),
    ).toEqual({ selectedSheetIds: ["one", "two", "three"], anchorSheetId: "one" });
  });

  it("keeps the current batch when opening a selected sheet context menu", () => {
    expect(resolveContextSheetSelection(["one", "three"], "three")).toEqual(["one", "three"]);
    expect(resolveContextSheetSelection(["one", "three"], "two")).toEqual(["two"]);
  });

  it("removes selections that are no longer visible", () => {
    expect(pruneSheetSelection(["one", "three"], ["two", "three"])).toEqual(["three"]);
  });

  it("keeps the first remaining document after a batch deletion", () => {
    expect(resolveFirstRemainingSheetId(["one", "two", "three"], ["one", "two"], "fallback")).toBe("three");
    expect(resolveFirstRemainingSheetId(["one", "two"], ["one", "two"], "fallback")).toBe("fallback");
  });
});
