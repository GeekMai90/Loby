// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React DOM、Vitest、写作库右键菜单协调器与 shared 文稿契约
 * [OUTPUT]: 验证单篇文稿右键菜单可以关闭并把目标 tab 交给 app 组合层
 * [POS]: library 右键菜单的动作回归测试，保护文稿列表到编辑器功能栏的直达链路
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectGroup, WritingProject, WritingSheet } from "@/shared/types";
import { useSidebarContextMenu } from "@/features/library/hooks/useSidebarContextMenu";

const group: ProjectGroup = { id: "group-default", title: "待整理", icon: "inbox", iconColor: "#007aff", description: "" };
const sheet: WritingSheet = {
  id: "sheet-1",
  title: "测试文稿",
  groupId: group.id,
  tags: [],
  targetWords: 1000,
  description: "",
  body: "# 测试文稿",
  createdAt: "2026-08-01",
  updatedAt: "2026-08-01",
  properties: {},
};
const project: WritingProject = {
  id: "project-1",
  title: "测试项目",
  status: "构思",
  groups: [group],
  sheets: [sheet],
  updatedAt: "2026-08-01",
};

interface ContextMenuHarnessProps {
  onOpenSheetFunctionRail: (sheetId: string, tab: "media" | "search" | "history") => void;
}

function ContextMenuHarness({ onOpenSheetFunctionRail }: ContextMenuHarnessProps) {
  const actions = useSidebarContextMenu({
    libraryPath: "/tmp/loby-library",
    projects: [project],
    onProjectsChange: vi.fn(),
    onActiveProjectChange: vi.fn(),
    onActiveSheetChange: vi.fn(),
    onActiveGroupChange: vi.fn(),
    onSidebarModeChange: vi.fn(),
    onProjectFilterChange: vi.fn(),
    onLibraryStatusChange: vi.fn(),
    onSkipNextLibrarySave: vi.fn(),
    onTrashChanged: vi.fn(),
    onSheetTrashCompleted: vi.fn(),
    onEditProject: vi.fn(),
    onManageDocumentProperties: vi.fn(),
    onFormatSheet: vi.fn(),
    onDuplicateSheet: vi.fn(),
    onOpenSheetFunctionRail,
    flushPendingSave: async () => undefined,
  });

  return createElement(
    "section",
    null,
    createElement(
      "button",
      {
        "data-testid": "open-menu",
        onClick: (event) => actions.openSheetContextMenu(event, sheet.id),
      },
      "open",
    ),
    createElement(
      "button",
      {
        "data-testid": "open-search",
        onClick: () => actions.openContextSheetFunctionRail("search"),
      },
      "search",
    ),
    createElement("output", { "data-testid": "menu-state" }, actions.sidebarContextMenu ? "open" : "closed"),
  );
}

describe("useSidebarContextMenu", () => {
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
    vi.restoreAllMocks();
    container.remove();
  });

  it("closes the context menu and opens the requested function tab for one sheet", async () => {
    const onOpenSheetFunctionRail = vi.fn();
    await act(async () => root.render(createElement(ContextMenuHarness, { onOpenSheetFunctionRail })));

    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="open-menu"]')?.click());
    expect(container.querySelector('[data-testid="menu-state"]')?.textContent).toBe("open");

    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="open-search"]')?.click());
    expect(onOpenSheetFunctionRail).toHaveBeenCalledWith(sheet.id, "search");
    expect(container.querySelector('[data-testid="menu-state"]')?.textContent).toBe("closed");
  });
});
