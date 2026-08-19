// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React DOM、Vitest、写作库维护弹窗状态与 LibraryMaintenanceDialogs
 * [OUTPUT]: 验证文稿移动的 id 回传、分组删除文案的派生规则，以及无待处理状态时不挂载任何 overlay
 * [POS]: library 维护弹窗边界的聚焦回归测试，保护删除/移动确认文案与回调映射在 App 拆分后不漂移
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LibraryMaintenanceDialogsProps } from "@/features/library/components/LibraryMaintenanceDialogs";
import { LibraryMaintenanceDialogs } from "@/features/library/components/LibraryMaintenanceDialogs";
import type { WritingProject, WritingSheet } from "@/shared/types";

vi.mock("@/features/library/components/MoveSheetDialog", () => ({
  MoveSheetDialog: ({ entries, onMove }: { entries: Array<{ sheet: WritingSheet }>; onMove: (target: { projectId: string }) => void }) =>
    createElement(
      "button",
      { "data-testid": "move-sheet-dialog", onClick: () => onMove({ projectId: "project-target" }) },
      String(entries.length),
    ),
}));

vi.mock("@/features/library/components/UnusedImageCleanupDialog", () => ({
  UnusedImageCleanupDialog: () => createElement("div", { "data-testid": "unused-image-dialog" }),
}));

vi.mock("@/shared/components/ConfirmDialog", () => ({
  ConfirmDialog: ({ title, message, confirmLabel }: { title: string; message: string; confirmLabel: string }) =>
    createElement("div", { "data-testid": `confirm-${title}` }, `${message}|${confirmLabel}`),
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

function createProps(overrides: Partial<LibraryMaintenanceDialogsProps> = {}): LibraryMaintenanceDialogsProps {
  return {
    projects: [project],
    moveEntries: [],
    onCloseMove: vi.fn(),
    onMoveSheets: vi.fn(),
    unusedImageCleanup: {
      candidates: [],
      selectedPaths: new Set(),
      dialogOpen: false,
      busy: false,
      onClose: vi.fn(),
      onTogglePath: vi.fn(),
      onSelectAll: vi.fn(),
      onPreview: vi.fn(),
      onSaveAs: vi.fn(),
      onConfirm: vi.fn(),
    },
    projectPendingTrash: null,
    onCancelProjectTrash: vi.fn(),
    onConfirmProjectTrash: vi.fn(),
    projectGroupPendingDelete: null,
    onCancelProjectGroupDelete: vi.fn(),
    onConfirmProjectGroupDelete: vi.fn(),
    sheetPendingTrash: null,
    onCancelSheetTrash: vi.fn(),
    onConfirmSheetTrash: vi.fn(),
    trashClearPending: false,
    onCancelTrashClear: vi.fn(),
    onConfirmTrashClear: vi.fn(),
    ...overrides,
  };
}

describe("LibraryMaintenanceDialogs", () => {
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

  async function renderDialogs(props: LibraryMaintenanceDialogsProps) {
    await act(async () => {
      root.render(createElement(LibraryMaintenanceDialogs, props));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  it("maps the move dialog selection back to the app with stable sheet ids", async () => {
    const onMoveSheets = vi.fn();
    await renderDialogs(createProps({ moveEntries: [{ project, sheet }], onMoveSheets }));

    document.body.querySelector<HTMLButtonElement>('[data-testid="move-sheet-dialog"]')?.click();
    expect(onMoveSheets).toHaveBeenCalledWith([sheet.id], { projectId: "project-target" });
  });

  it("derives group deletion copy from the pending project state", async () => {
    await renderDialogs(
      createProps({
        projectGroupPendingDelete: { project, group: { id: "group-delete", title: "草稿" } },
      }),
    );

    expect(document.body.querySelector('[data-testid="confirm-删除分组"]')?.textContent).toContain("共 1 篇");
    expect(document.body.querySelector('[data-testid="confirm-删除分组"]')?.textContent).toContain("删除并移到待整理");
  });

  it("mounts no destructive overlay while nothing is pending", async () => {
    await renderDialogs(createProps());

    expect(container.innerHTML).toBe("");
  });
});
