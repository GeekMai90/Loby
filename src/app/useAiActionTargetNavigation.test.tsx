// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React DOM、Vitest、AI 动作/项目夹具与 useAiActionTargetNavigation
 * [OUTPUT]: 验证普通文稿、空项目、随手记项目、缺失目标和未知动作的导航副作用
 * [POS]: app AI 动作目标导航的聚焦回归测试，保护动作卡片返回原位置时的状态与错误反馈
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAiActionTargetNavigation } from "@/app/useAiActionTargetNavigation";
import { NOTES_PROJECT_ID } from "@/features/library/model/projectModel";
import type { AiAction, WritingProject, WritingSheet } from "@/shared/types";

const sheet: WritingSheet = {
  id: "sheet-target",
  title: "目标文稿",
  groupId: "group-target",
  tags: [],
  targetWords: 0,
  description: "",
  body: "# 目标文稿",
  createdAt: "2026-08-19",
  updatedAt: "2026-08-19",
  properties: {},
};

function project(id: string, sheets: WritingSheet[], groupId = "group-target"): WritingProject {
  return {
    id,
    title: id === NOTES_PROJECT_ID ? "随手记" : "目标项目",
    status: "初稿",
    groups: [{ id: groupId, title: "目标分组" }],
    sheets,
    updatedAt: "2026-08-19",
  };
}

function action(overrides: Partial<AiAction>): AiAction {
  return {
    id: "action-target",
    type: "insertText",
    status: "proposed",
    title: "动作",
    summary: "摘要",
    payload: { text: "补充内容" },
    createdAt: "2026-08-19",
    ...overrides,
  };
}

type NavigationOptions = Parameters<typeof useAiActionTargetNavigation>[0];

function NavigationHarness(props: NavigationOptions) {
  const navigation = useAiActionTargetNavigation(props);
  return createElement(
    "section",
    null,
    createElement("button", { "data-testid": "open", onClick: () => navigation.openAiActionTarget("action-target") }),
    createElement("button", { "data-testid": "open-missing-action", onClick: () => navigation.openAiActionTarget("missing") }),
  );
}

describe("useAiActionTargetNavigation", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
    container.remove();
  });

  function createOptions(overrides: Partial<NavigationOptions> = {}): NavigationOptions {
    return {
      actions: [],
      projects: [],
      onActionChange: vi.fn(),
      onSheetSelect: vi.fn(),
      onSheetFiltersReset: vi.fn(),
      onInspectorOpenChange: vi.fn(),
      onLibraryStatusChange: vi.fn(),
      onProjectFilterChange: vi.fn(),
      onActiveProjectChange: vi.fn(),
      onActiveSheetChange: vi.fn(),
      onActiveGroupChange: vi.fn(),
      onActiveNoteGroupChange: vi.fn(),
      onSidebarModeChange: vi.fn(),
      onRememberProjectGroup: vi.fn(),
      ...overrides,
    };
  }

  async function renderNavigation(options: NavigationOptions) {
    await act(async () => root.render(createElement(NavigationHarness, options)));
  }

  async function click(testId = "open") {
    await act(async () => container.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`)?.click());
  }

  it("returns a sheet action to its document, resets filters, and opens the Inspector", async () => {
    const options = createOptions({
      actions: [action({ targetSheetId: sheet.id, targetSheetTitle: sheet.title })],
      projects: [project("project-target", [sheet])],
    });
    await renderNavigation(options);
    await click();

    expect(options.onProjectFilterChange).toHaveBeenCalledWith("active");
    expect(options.onSheetSelect).toHaveBeenCalledWith(sheet.id);
    expect(options.onSheetFiltersReset).toHaveBeenCalledOnce();
    expect(options.onInspectorOpenChange).toHaveBeenCalledWith(true);
    expect(options.onLibraryStatusChange).toHaveBeenCalledWith("已切回 AI 动作目标文稿「目标文稿」。");
  });

  it("returns an empty project action to project mode and remembers its first group", async () => {
    const emptyProject = project("project-target", []);
    const options = createOptions({
      actions: [action({ type: "saveExport", targetProjectId: emptyProject.id, targetProjectTitle: emptyProject.title })],
      projects: [emptyProject],
    });
    await renderNavigation(options);
    await click();

    expect(options.onActiveProjectChange).toHaveBeenCalledWith(emptyProject.id);
    expect(options.onActiveGroupChange).toHaveBeenCalledWith("group-target");
    expect(options.onActiveSheetChange).toHaveBeenCalledWith("");
    expect(options.onSidebarModeChange).toHaveBeenCalledWith("project");
    expect(options.onProjectFilterChange).toHaveBeenCalledWith("active");
    expect(options.onActiveNoteGroupChange).toHaveBeenCalledWith("");
    expect(options.onRememberProjectGroup).toHaveBeenCalledWith(emptyProject.id, "group-target");
    expect(options.onLibraryStatusChange).toHaveBeenCalledWith("已切回 AI 动作目标项目「目标项目」。");
  });

  it("returns an empty notes action to its note group without changing the project filter", async () => {
    const notesProject = project(NOTES_PROJECT_ID, [], "notes-group");
    const options = createOptions({
      actions: [action({ type: "saveExport", targetProjectId: notesProject.id, targetProjectTitle: notesProject.title })],
      projects: [notesProject],
    });
    await renderNavigation(options);
    await click();

    expect(options.onSidebarModeChange).toHaveBeenCalledWith("library");
    expect(options.onActiveNoteGroupChange).toHaveBeenCalledWith("notes-group");
    expect(options.onProjectFilterChange).not.toHaveBeenCalled();
    expect(options.onRememberProjectGroup).not.toHaveBeenCalled();
  });

  it("writes a missing target error back to the action and ignores an unknown action id", async () => {
    const missingTargetAction = action({ targetSheetId: "removed-sheet", targetSheetTitle: "已删除文稿" });
    const options = createOptions({ actions: [missingTargetAction] });
    await renderNavigation(options);
    await click();

    const message = "无法找到这个 AI 动作对应的文稿「已删除文稿」。";
    expect(options.onLibraryStatusChange).toHaveBeenCalledWith(message);
    expect(options.onActionChange).toHaveBeenCalledOnce();
    expect(vi.mocked(options.onActionChange).mock.calls[0]?.[1](missingTargetAction)).toEqual({
      ...missingTargetAction,
      error: message,
    });
    expect(options.onSheetSelect).not.toHaveBeenCalled();

    vi.mocked(options.onLibraryStatusChange).mockClear();
    await click("open-missing-action");
    expect(options.onLibraryStatusChange).not.toHaveBeenCalled();
  });
});
