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

const persistenceMocks = vi.hoisted(() => ({
  openLocalPath: vi.fn(),
  revealLocalPath: vi.fn(),
  resolveSheetPath: vi.fn(),
}));

vi.mock("@/features/library/model/persistence", async () => {
  const actual = await vi.importActual<typeof import("@/features/library/model/persistence")>("@/features/library/model/persistence");
  return { ...actual, ...persistenceMocks };
});

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
  libraryPath?: string;
  onLibraryStatusChange?: (status: string) => void;
}

function ContextMenuHarness({
  onOpenSheetFunctionRail,
  libraryPath = "/tmp/loby-library",
  onLibraryStatusChange,
}: ContextMenuHarnessProps) {
  const actions = useSidebarContextMenu({
    libraryPath,
    projects: [project],
    onProjectsChange: vi.fn(),
    onActiveProjectChange: vi.fn(),
    onActiveSheetChange: vi.fn(),
    onActiveGroupChange: vi.fn(),
    onSidebarModeChange: vi.fn(),
    onProjectFilterChange: vi.fn(),
    onLibraryStatusChange: onLibraryStatusChange ?? vi.fn(),
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
        "data-testid": "open-project-menu",
        onClick: (event) => actions.openProjectContextMenu(event, project),
      },
      "project",
    ),
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
        "data-testid": "open-default-app",
        onClick: () => void actions.openContextSheetWithDefaultApplication(),
      },
      "default app",
    ),
    createElement(
      "button",
      {
        "data-testid": "reveal-sheet",
        onClick: () => void actions.showSidebarContextTargetInFinder(),
      },
      "reveal",
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
    createElement("output", { "data-testid": "menu-kind" }, actions.sidebarContextMenu?.kind ?? "closed"),
  );
}

describe("useSidebarContextMenu", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    persistenceMocks.openLocalPath.mockReset().mockResolvedValue(undefined);
    persistenceMocks.revealLocalPath.mockReset().mockResolvedValue(undefined);
    persistenceMocks.resolveSheetPath.mockReset().mockResolvedValue("C:\\Users\\Mai\\Loby\\实际目录\\真实文稿.md");
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

  it("opens project and sheet context state for a Windows library path", async () => {
    const onOpenSheetFunctionRail = vi.fn();
    await act(async () => root.render(createElement(ContextMenuHarness, { onOpenSheetFunctionRail, libraryPath: "C:\\Users\\Mai\\Loby" })));

    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="open-project-menu"]')?.click());
    expect(container.querySelector('[data-testid="menu-kind"]')?.textContent).toBe("project");

    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="open-menu"]')?.click());
    expect(container.querySelector('[data-testid="menu-kind"]')?.textContent).toBe("sheet");
  });

  it("resolves the actual Markdown path before revealing or opening a sheet", async () => {
    await act(async () => root.render(createElement(ContextMenuHarness, { onOpenSheetFunctionRail: vi.fn() })));

    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="open-menu"]')?.click());
    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="reveal-sheet"]')?.click());
    expect(persistenceMocks.resolveSheetPath).toHaveBeenCalledWith("/tmp/loby-library", sheet.id);
    expect(persistenceMocks.revealLocalPath).toHaveBeenCalledWith("C:\\Users\\Mai\\Loby\\实际目录\\真实文稿.md");

    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="open-menu"]')?.click());
    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="open-default-app"]')?.click());
    expect(persistenceMocks.openLocalPath).toHaveBeenCalledWith("C:\\Users\\Mai\\Loby\\实际目录\\真实文稿.md");
  });
});
