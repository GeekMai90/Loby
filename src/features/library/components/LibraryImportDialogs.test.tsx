// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React DOM、Vitest、Markdown 导入 controller 与 LibraryImportDialogs
 * [OUTPUT]: 验证录入弹窗的 controller 透传、快速记录回调，以及不牵连任何维护类 overlay
 * [POS]: library 录入弹窗边界的聚焦回归测试，保护 onboarding 首屏与主界面共用的最小依赖面
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MarkdownImportController } from "@/features/library/hooks/useMarkdownImport";
import type { LibraryImportDialogsProps } from "@/features/library/components/LibraryImportDialogs";
import { LibraryImportDialogs } from "@/features/library/components/LibraryImportDialogs";
import type { WritingProject, WritingSheet } from "@/shared/types";

vi.mock("@/features/library/components/MarkdownImportDialog", () => ({
  MarkdownImportDialog: ({ controller }: { controller: MarkdownImportController }) =>
    createElement("div", { "data-testid": "markdown-import-dialog" }, controller.targetProjectId),
}));

vi.mock("@/features/library/components/QuickCaptureDialog", () => ({
  QuickCaptureDialog: ({ onSave }: { onSave: (body: string) => void }) =>
    createElement("button", { "data-testid": "quick-capture-dialog", onClick: () => onSave("快速记录") }, "快速记录"),
}));

const sheet: WritingSheet = {
  id: "sheet-1",
  title: "第一篇",
  tags: [],
  targetWords: 0,
  description: "",
  body: "正文",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  properties: {},
  groupId: "group-delete",
};

const project: WritingProject = {
  id: "project-1",
  title: "测试项目",
  status: "修改中",
  updatedAt: "2026-01-01T00:00:00.000Z",
  sheets: [sheet],
};

const markdownImport = {
  open: true,
  busy: false,
  phase: "idle" as const,
  targetProjectId: "project-1",
  targetProjects: [project],
  scan: null,
  result: null,
  error: "",
  metadataSummary: { preservedKeys: [], droppedKeys: [] },
  openImport: vi.fn(),
  closeImport: vi.fn(),
  resetSource: vi.fn(),
  setTargetProjectId: vi.fn(),
  selectFiles: vi.fn(),
  selectFolder: vi.fn(),
  chooseAttachmentFolder: vi.fn(),
  confirmImport: vi.fn(),
} satisfies MarkdownImportController;

function createProps(overrides: Partial<LibraryImportDialogsProps> = {}): LibraryImportDialogsProps {
  return {
    markdownImport,
    quickCaptureOpen: false,
    onCloseQuickCapture: vi.fn(),
    onSaveQuickCapture: vi.fn(),
    ...overrides,
  };
}

describe("LibraryImportDialogs", () => {
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
    document.body.replaceChildren();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  async function renderDialogs(props: LibraryImportDialogsProps) {
    await act(async () => {
      root.render(createElement(LibraryImportDialogs, props));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  it("keeps import and quick capture surfaces inside the library host", async () => {
    const onSaveQuickCapture = vi.fn();
    await renderDialogs(createProps({ quickCaptureOpen: true, onSaveQuickCapture }));

    expect(document.body.querySelector('[data-testid="markdown-import-dialog"]')?.textContent).toBe("project-1");
    document.body.querySelector<HTMLButtonElement>('[data-testid="quick-capture-dialog"]')?.click();
    expect(onSaveQuickCapture).toHaveBeenCalledWith("快速记录");
  });

  it("mounts nothing while both intake surfaces are closed", async () => {
    await renderDialogs(createProps({ markdownImport: { ...markdownImport, open: false } }));

    expect(container.innerHTML).toBe("");
  });
});
