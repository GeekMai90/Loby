import { describe, expect, it } from "vitest";
import { buildAiActionCardState } from "@/features/assistant/model/aiActionCardState";
import type { AiAction, WritingProject, WritingSheet } from "@/shared/types";

describe("aiActionCardState", () => {
  it("allows a complete action on its original target", () => {
    const state = buildAiActionCardState(action({ targetProjectId: "project-1", targetSheetId: "sheet-1", payload: { text: "补一句" } }), {
      activeProject: project("project-1"),
      activeSheet: sheet("sheet-1"),
    });

    expect(state).toMatchObject({
      canApply: true,
      canReject: true,
      canExecute: true,
      invalid: false,
      showTargetWarning: false,
      showValidationWarning: false,
    });
  });

  it("disables proposed actions when the active project or sheet is wrong", () => {
    const projectMismatch = buildAiActionCardState(
      action({ targetProjectId: "project-2", targetProjectTitle: "别的项目", payload: { text: "补一句" } }),
      {
        activeProject: project("project-1"),
        activeSheet: sheet("sheet-1"),
      },
    );
    const sheetMismatch = buildAiActionCardState(
      action({ targetProjectId: "project-1", targetSheetId: "sheet-2", targetSheetTitle: "第二篇", payload: { text: "补一句" } }),
      {
        activeProject: project("project-1"),
        activeSheet: sheet("sheet-1"),
      },
    );

    expect(projectMismatch).toMatchObject({
      canApply: true,
      canExecute: false,
      invalid: true,
      showTargetWarning: true,
      targetWarning: "这个动作是为项目「别的项目」生成的，请先切回该项目后执行。",
    });
    expect(sheetMismatch).toMatchObject({
      canApply: true,
      canExecute: false,
      invalid: true,
      showTargetWarning: true,
      targetWarning: "这个动作是为文稿「第二篇」生成的，请先切回该文稿后执行。",
    });
  });

  it("keeps failed actions retryable but disabled on the wrong target", () => {
    const state = buildAiActionCardState(
      action({
        status: "failed",
        targetProjectId: "project-1",
        targetSheetId: "sheet-2",
        targetSheetTitle: "第二篇",
        payload: { text: "补一句" },
      }),
      {
        activeProject: project("project-1"),
        activeSheet: sheet("sheet-1"),
      },
    );

    expect(state).toMatchObject({
      canApply: true,
      canReject: true,
      canExecute: false,
      invalid: true,
      showTargetWarning: true,
      showValidationWarning: false,
    });
  });

  it("shows validation warnings for incomplete proposed actions", () => {
    const state = buildAiActionCardState(action({ payload: {} }), {
      activeProject: project("project-1"),
      activeSheet: sheet("sheet-1"),
    });

    expect(state).toMatchObject({
      canApply: true,
      canExecute: false,
      invalid: true,
      showValidationWarning: true,
      validationIssues: ["缺少要插入的文本，请让 AI 补充 text。"],
    });
  });
});

function action(overrides: Partial<AiAction> = {}): AiAction {
  return {
    id: "action-1",
    type: "insertText",
    status: "proposed",
    title: "插入文字",
    summary: "补充一句",
    payload: { text: "补一句" },
    createdAt: "2026-07-09T10:00:00+08:00",
    ...overrides,
  };
}

function project(id: string): WritingProject {
  return {
    id,
    title: "项目",
    status: "构思",
    projectGoal: { enabled: false, unit: "words", target: 0 },
    groups: [],
    sheets: [sheet("sheet-1")],
    updatedAt: "2026-07-09T10:00:00+08:00",
  };
}

function sheet(id: string): WritingSheet {
  return {
    id,
    groupId: "group-1",
    title: "文稿",
    summary: "",
    status: "初稿",
    tags: [],
    body: "",
    targetWords: 1000,
    createdAt: "2026-07-09T10:00:00+08:00",
    updatedAt: "2026-07-09T10:00:00+08:00",
    properties: {},
  };
}
