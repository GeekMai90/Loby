// @vitest-environment happy-dom
/**
 * [INPUT]: 依赖 React DOM、Vitest、AI action/effect 与写作库文稿契约
 * [OUTPUT]: 验证 AI 插入和撤回始终以编辑器实时正文校验并创建恢复快照
 * [POS]: AI 动作执行边界的无损回归，防止陈旧 React 文稿把作者刚输入的内容写入错误恢复点或直接覆盖
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AiAction, SheetVersion, WritingProject, WritingSheet } from "@/shared/types";
import { useAiActionExecutor } from "@/features/assistant/hooks/useAiActionExecutor";

const reactActEnvironment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe("useAiActionExecutor document authority", () => {
  it("creates the pre-insertion snapshot from the latest editor body", async () => {
    const staleSheet = sheet({ body: "# 标题\n\n已提交" });
    const latestSheet = sheet({ body: "# 标题\n\n已提交，刚输入" });
    const action = insertTextAction();
    let updatedSheet: WritingSheet | undefined;
    const executor = mountExecutor({
      action,
      staleSheet,
      latestSheet,
      updateSheet: (_sheetId, updater) => {
        updatedSheet = updater(latestSheet);
      },
    });

    await act(async () => executor.applyAiAction(action.id));

    expect(updatedSheet?.versions?.[0]?.body).toBe(latestSheet.body);
    expect(updatedSheet?.body).toContain("已提交，刚输入");
    expect(updatedSheet?.body).toContain("AI 补充");
  });

  it("refuses an AI revert when the live editor has newer user input", () => {
    const restoreVersion = version("version-before", "AI 插入前");
    const staleSheet = sheet({ body: "AI 插入后", versions: [restoreVersion] });
    const latestSheet = sheet({ body: "AI 插入后，用户又写了内容", versions: [restoreVersion] });
    const action: AiAction = {
      ...insertTextAction(),
      status: "applied",
      effect: {
        type: "sheetVersionRestore",
        sheetId: staleSheet.id,
        sheetTitle: staleSheet.title,
        versionId: restoreVersion.id,
        appliedBody: staleSheet.body,
      },
    };
    const updateProject = vi.fn();
    const updateAction = vi.fn();
    const executor = mountExecutor({ action, staleSheet, latestSheet, updateProject, updateAction });

    act(() => executor.revertAiAction(action.id));

    expect(updateProject).not.toHaveBeenCalled();
    expect(updateAction).toHaveBeenCalledWith(action.id, expect.any(Function));
    const failure = updateAction.mock.calls[0]?.[1](action);
    expect(failure.error).toContain("已经被修改");
  });
});

function mountExecutor({
  action,
  staleSheet,
  latestSheet,
  updateSheet = vi.fn(),
  updateProject = vi.fn(),
  updateAction = vi.fn(),
}: {
  action: AiAction;
  staleSheet: WritingSheet;
  latestSheet: WritingSheet;
  updateSheet?: (sheetId: string, updater: (sheet: WritingSheet) => WritingSheet) => void;
  updateProject?: (projectId: string, updater: (project: WritingProject) => WritingProject) => void;
  updateAction?: (actionId: string, updater: (action: AiAction) => AiAction) => void;
}) {
  const project = writingProject(staleSheet);
  let executor: ReturnType<typeof useAiActionExecutor> | undefined;

  function Harness() {
    executor = useAiActionExecutor({
      aiActions: [action],
      projects: [project],
      activeProject: project,
      activeSheet: staleSheet,
      activeProjectId: project.id,
      activeSheetId: staleSheet.id,
      resolvedActiveGroupId: "group-1",
      libraryPath: "/Library",
      editorRef: { current: null },
      updateProject,
      updateSheet,
      getSheetById: () => latestSheet,
      updateAction,
      onActiveProjectChange: vi.fn(),
      onActiveSheetChange: vi.fn(),
      onActiveGroupChange: vi.fn(),
      onActiveGroupIdsByProjectChange: vi.fn(),
      onSheetSearchChange: vi.fn(),
      onInspectorOpenChange: vi.fn(),
      onLibraryStatusChange: vi.fn(),
      onResourcesChanged: vi.fn(),
    });
    return null;
  }

  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(<Harness />));
  if (!executor) throw new Error("AI action executor did not mount");
  return executor;
}

function insertTextAction(): AiAction {
  return {
    id: "action-1",
    type: "insertText",
    status: "proposed",
    title: "插入补充",
    summary: "补充正文",
    payload: { text: "AI 补充", target: "end" },
    createdAt: "2026-07-31T10:00:00.000Z",
    targetProjectId: "project-1",
    targetSheetId: "sheet-1",
  };
}

function writingProject(currentSheet: WritingSheet): WritingProject {
  return {
    id: "project-1",
    title: "项目",
    status: "构思",
    projectGoal: { enabled: false, unit: "words", target: 0 },
    groups: [{ id: "group-1", title: "正文" }],
    sheets: [currentSheet],
    updatedAt: "2026-07-31T10:00:00.000Z",
    documentPropertyDefinitions: [],
  };
}

function sheet(overrides: Partial<WritingSheet> = {}): WritingSheet {
  return {
    id: "sheet-1",
    title: "标题",
    groupId: "group-1",
    tags: [],
    targetWords: 1_000,
    description: "",
    body: "",
    createdAt: "2026-07-31T10:00:00.000Z",
    updatedAt: "2026-07-31T10:00:00.000Z",
    properties: {},
    ...overrides,
  };
}

function version(id: string, body: string): SheetVersion {
  return {
    id,
    title: "AI 插入前",
    body,
    createdAt: "2026-07-31T10:00:00.000Z",
    wordCount: body.length,
    source: "ai",
  };
}
