import { describe, expect, it } from "vitest";
import type { WritingProject, WritingSheet } from "@/shared/types";
import { DEFAULT_USER_GROUP_ID } from "@/features/library/model/projectModel";
import { applySheetMoveBatch } from "@/features/library/model/sheetMoveBatch";

describe("applySheetMoveBatch", () => {
  it("moves sheets from different projects and skips sheets already at the destination", () => {
    const first = sheet("first", "source");
    const second = sheet("second", "source");
    const current = sheet("current", "published");
    const result = applySheetMoveBatch({
      projects: [project("one", [first]), project("two", [second]), project("target", [current], true)],
      sheetIds: [first.id, second.id, current.id],
      target: { projectId: "target", groupId: "published" },
    });

    expect(result.movedSheets.map((item) => item.movedSheet.id)).toEqual(["first", "second"]);
    expect(result.alreadyInTargetCount).toBe(1);
    expect(result.projects.find((item) => item.id === "one")?.sheets).toHaveLength(0);
    expect(result.projects.find((item) => item.id === "two")?.sheets).toHaveLength(0);
    expect(result.projects.find((item) => item.id === "target")?.sheets.map((item) => item.id)).toEqual(["current", "first", "second"]);
    expect(result.movedSheets.map((item) => item.movedSheet.updatedAt)).toEqual(["2026-07-19 10:00:00", "2026-07-19 10:00:00"]);

    const restoredProjects = result.movedSheets.reduce((projects, move) => {
      return applySheetMoveBatch({
        projects,
        sheetIds: [move.movedSheet.id],
        target: {
          projectId: move.sourceProject.id,
          groupId: move.sourceSheet.groupId,
        },
      }).projects;
    }, result.projects);

    expect(restoredProjects.find((item) => item.id === "one")?.sheets.map((item) => item.id)).toEqual(["first"]);
    expect(restoredProjects.find((item) => item.id === "two")?.sheets.map((item) => item.id)).toEqual(["second"]);
    expect(restoredProjects.find((item) => item.id === "target")?.sheets.map((item) => item.id)).toEqual(["current"]);
  });

  it("reports same-key type conflicts while preserving the source value", () => {
    const sourceSheet = { ...sheet("first", "source"), properties: { 渠道: "公众号" } };
    const source = {
      ...project("source", [sourceSheet]),
      documentPropertyDefinitions: [{ id: "source-channel", key: "渠道", label: "渠道", type: "text" as const }],
    };
    const target = {
      ...project("target", [], true),
      documentPropertyDefinitions: [
        {
          id: "target-channel",
          key: "渠道",
          label: "发布渠道",
          type: "select" as const,
          defaultValue: "博客",
        },
      ],
    };

    const result = applySheetMoveBatch({
      projects: [source, target],
      sheetIds: [sourceSheet.id],
      target: { projectId: target.id },
    });

    expect(result.movedSheets[0].movedSheet.properties?.渠道).toBe("公众号");
    expect(result.movedSheets[0].propertyTypeConflicts).toEqual([
      { key: "渠道", label: "发布渠道", sourceType: "text", targetType: "select" },
    ]);
  });
});

function project(id: string, sheets: WritingSheet[], destination = false): WritingProject {
  return {
    id,
    title: id,
    status: "构思",
    projectGoal: { enabled: false, unit: "words", target: 0 },
    groups: destination
      ? [
          { id: DEFAULT_USER_GROUP_ID, title: "待整理" },
          { id: "published", title: "已发布" },
        ]
      : [{ id: DEFAULT_USER_GROUP_ID, title: "待整理" }],
    sheets,
    updatedAt: "2026-07-19 10:00:00",
  };
}

function sheet(id: string, groupId: string): WritingSheet {
  return {
    id,
    groupId,
    title: id,
    tags: [],
    targetWords: 1000,
    description: "",
    body: `# ${id}`,
    createdAt: "2026-07-19 10:00:00",
    updatedAt: "2026-07-19 10:00:00",
    properties: {},
  };
}
