import { describe, expect, it } from "vitest";
import { resolveAiActionNavigationTarget } from "./aiActionNavigation";
import type { AiAction, WritingProject, WritingSheet } from "../types";

describe("aiActionNavigation", () => {
  it("resolves sheet actions to their owner project and group", () => {
    expect(
      resolveAiActionNavigationTarget(action({ targetSheetId: "sheet-2", targetSheetTitle: "第二篇" }), [
        project("project-1", [sheet("sheet-1")]),
        project("project-2", [sheet("sheet-2", { title: "第二篇", groupId: "group-2" })]),
      ]),
    ).toEqual({
      ok: true,
      projectId: "project-2",
      projectTitle: "项目 project-2",
      sheetId: "sheet-2",
      sheetTitle: "第二篇",
      groupId: "group-2",
    });
  });

  it("resolves project actions to the target project and its first sheet", () => {
    expect(
      resolveAiActionNavigationTarget(action({ type: "saveExport", targetProjectId: "project-2" }), [
        project("project-1", [sheet("sheet-1")]),
        project("project-2", [sheet("sheet-2", { title: "第二篇", groupId: "group-2" })]),
      ]),
    ).toEqual({
      ok: true,
      projectId: "project-2",
      projectTitle: "项目 project-2",
      sheetId: "sheet-2",
      sheetTitle: "第二篇",
      groupId: "group-2",
    });
  });

  it("reports missing sheet or project targets", () => {
    expect(resolveAiActionNavigationTarget(action({ targetSheetId: "missing", targetSheetTitle: "丢失文稿" }), [])).toEqual({
      ok: false,
      message: "无法找到这个 AI 动作对应的文稿「丢失文稿」。",
    });
    expect(resolveAiActionNavigationTarget(action({ targetProjectId: "missing", targetProjectTitle: "丢失项目" }), [])).toEqual({
      ok: false,
      message: "无法找到这个 AI 动作对应的项目「丢失项目」。",
    });
  });
});

function action(overrides: Partial<AiAction> = {}): AiAction {
  return {
    id: "action-1",
    type: "insertText",
    status: "proposed",
    title: "动作",
    summary: "摘要",
    payload: { text: "补一句" },
    createdAt: "2026-07-09T10:00:00+08:00",
    ...overrides,
  };
}

function project(id: string, sheets: WritingSheet[]): WritingProject {
  return {
    id,
    title: `项目 ${id}`,
    description: "",
    status: "构思",
    targetPlatform: "公众号",
    targetWords: 1000,
    tags: [],
    groups: [{ id: "group-1", title: "默认组", icon: "folder", iconColor: "#007aff", description: "" }],
    sheets,
    updatedAt: "2026-07-09T10:00:00+08:00",
  };
}

function sheet(id: string, overrides: Partial<WritingSheet> = {}): WritingSheet {
  return {
    id,
    groupId: "group-1",
    title: `文稿 ${id}`,
    summary: "",
    status: "初稿",
    body: "",
    targetWords: 1000,
    updatedAt: "2026-07-09T10:00:00+08:00",
    ...overrides,
  };
}
