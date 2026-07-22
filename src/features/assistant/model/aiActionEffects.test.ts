import { describe, expect, it } from "vitest";
import {
  AI_ACTION_EFFECT_MESSAGES,
  createdSheetMatchesEffect,
  validateAiActionTarget,
  validateCreatedSheetRevertEffect,
  validateSheetVersionRestoreEffect,
} from "@/features/assistant/model/aiActionEffects";
import type { AiAction, AiActionEffect, SheetVersion, WritingProject, WritingSheet } from "@/shared/types";

describe("aiActionEffects", () => {
  it("matches AI-created sheets against the recorded effect", () => {
    const effect = createdSheetEffect();

    expect(createdSheetMatchesEffect(sheet("sheet-2", { title: "AI 素材", body: "素材正文", targetWords: 500 }), effect)).toBe(true);
    expect(createdSheetMatchesEffect(sheet("sheet-2", { title: "AI 素材", body: "用户修改过", targetWords: 500 }), effect)).toBe(false);
  });

  it("allows deleting an unchanged AI-created sheet", () => {
    const effect = createdSheetEffect();
    const projects = [
      project({
        id: "project-1",
        sheets: [sheet("sheet-2", { title: "AI 素材", body: "素材正文", targetWords: 500 })],
      }),
    ];

    const result = validateCreatedSheetRevertEffect(projects, effect);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.target.ownerProject.id).toBe("project-1");
      expect(result.target.targetSheet.id).toBe("sheet-2");
    }
  });

  it("blocks deleting a missing or changed AI-created sheet", () => {
    const effect = createdSheetEffect();

    expect(validateCreatedSheetRevertEffect([], effect)).toEqual({
      ok: false,
      message: AI_ACTION_EFFECT_MESSAGES.createdSheetMissing,
    });
    expect(
      validateCreatedSheetRevertEffect(
        [project({ id: "project-1", sheets: [sheet("sheet-2", { title: "用户改名", body: "素材正文", targetWords: 500 })] })],
        effect,
      ),
    ).toEqual({
      ok: false,
      message: AI_ACTION_EFFECT_MESSAGES.createdSheetChanged,
    });
  });

  it("finds the pre-action version for reversible insert actions", () => {
    const restoreVersion = version("version-1", "旧正文");
    const effect = sheetVersionRestoreEffect({ appliedBody: "旧正文\n\nAI 插入\n" });
    const projects = [
      project({
        sheets: [sheet("sheet-1", { body: "旧正文\n\nAI 插入\n", versions: [restoreVersion] })],
      }),
    ];

    const result = validateSheetVersionRestoreEffect(projects, effect);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.target.restoreVersion).toBe(restoreVersion);
      expect(result.target.targetSheet.id).toBe("sheet-1");
    }
  });

  it("blocks restore when the version is missing or the user edited after the AI action", () => {
    const effect = sheetVersionRestoreEffect({ appliedBody: "旧正文\n\nAI 插入\n" });

    expect(validateSheetVersionRestoreEffect([project({ sheets: [sheet("sheet-1")] })], effect)).toEqual({
      ok: false,
      message: AI_ACTION_EFFECT_MESSAGES.restoreVersionMissing,
    });
    expect(
      validateSheetVersionRestoreEffect(
        [project({ sheets: [sheet("sheet-1", { body: "用户继续修改", versions: [version("version-1", "旧正文")] })] })],
        effect,
      ),
    ).toEqual({
      ok: false,
      message: AI_ACTION_EFFECT_MESSAGES.restoreBodyChanged,
    });
  });

  it("keeps legacy restore effects reversible when appliedBody was not recorded", () => {
    const result = validateSheetVersionRestoreEffect(
      [project({ sheets: [sheet("sheet-1", { body: "用户当前正文", versions: [version("version-1", "旧正文")] })] })],
      sheetVersionRestoreEffect(),
    );

    expect(result.ok).toBe(true);
  });

  it("guards action execution against project or sheet target mismatches", () => {
    expect(
      validateAiActionTarget(action({ targetProjectId: "project-2", targetProjectTitle: "别的项目" }), {
        activeProject: project({ id: "project-1" }),
        activeSheet: sheet("sheet-1"),
      }),
    ).toEqual({
      ok: false,
      message: "这个动作是为项目「别的项目」生成的，请先切回该项目后执行。",
    });
    expect(
      validateAiActionTarget(action({ targetProjectId: "project-1", targetSheetId: "sheet-2", targetSheetTitle: "第二篇" }), {
        activeProject: project({ id: "project-1" }),
        activeSheet: sheet("sheet-1"),
      }),
    ).toEqual({
      ok: false,
      message: "这个动作是为文稿「第二篇」生成的，请先切回该文稿后执行。",
    });
    expect(
      validateAiActionTarget(action({ type: "saveExport", targetProjectId: "project-1", targetSheetId: "sheet-2" }), {
        activeProject: project({ id: "project-1" }),
        activeSheet: sheet("sheet-1"),
      }),
    ).toEqual({ ok: true });
    expect(validateAiActionTarget(action(), { activeProject: project(), activeSheet: sheet("sheet-1") })).toEqual({ ok: true });
  });
});

function project(overrides: Partial<WritingProject> = {}): WritingProject {
  return {
    id: "project-1",
    title: "项目",
    description: "",
    status: "构思",
    targetPlatform: "公众号",
    targetWords: 1000,
    tags: [],
    groups: [],
    sheets: [sheet("sheet-1")],
    updatedAt: "2026-07-09T10:00:00+08:00",
    ...overrides,
  };
}

function sheet(id: string, overrides: Partial<WritingSheet> = {}): WritingSheet {
  return {
    id,
    title: "文稿",
    status: "构思",
    targetWords: 1000,
    summary: "",
    body: "正文",
    updatedAt: "2026-07-09T10:00:00+08:00",
    ...overrides,
  };
}

function version(id: string, body: string): SheetVersion {
  return {
    id,
    title: "自动保存",
    body,
    createdAt: "2026-07-09T10:00:00+08:00",
    wordCount: 10,
    source: "ai",
  };
}

function createdSheetEffect(): Extract<AiActionEffect, { type: "createdSheet" }> {
  return {
    type: "createdSheet",
    projectId: "project-1",
    sheetId: "sheet-2",
    sheetTitle: "AI 素材",
    summary: "",
    body: "素材正文",
    targetWords: 500,
  };
}

function sheetVersionRestoreEffect(
  overrides: Partial<Extract<AiActionEffect, { type: "sheetVersionRestore" }>> = {},
): Extract<AiActionEffect, { type: "sheetVersionRestore" }> {
  return {
    type: "sheetVersionRestore",
    sheetId: "sheet-1",
    sheetTitle: "文稿",
    versionId: "version-1",
    ...overrides,
  };
}

function action(overrides: Partial<AiAction> = {}): AiAction {
  return {
    id: "action-1",
    type: "insertText",
    status: "proposed",
    title: "插入文本",
    summary: "插入",
    payload: { text: "正文" },
    createdAt: "2026-07-09T10:00:00+08:00",
    ...overrides,
  };
}
