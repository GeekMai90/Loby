// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React DOM、Vitest、共享 ContextMenu 与 SidebarContextMenu
 * [OUTPUT]: 验证项目与单篇文稿右键菜单的分支、文案和动作转发边界
 * [POS]: 写作库右键菜单视图的聚焦回归测试，保护 App 拆分后菜单组合不改变
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import {
  SidebarContextMenu,
  type SidebarContextMenuActions,
  type SidebarContextMenuProps,
} from "@/features/library/components/SidebarContextMenu";
import type { WritingProject } from "@/shared/types";

const sheet = {
  id: "sheet-context",
  title: "右键菜单测试",
  groupId: "group-default",
  tags: [],
  targetWords: 0,
  description: "",
  body: "正文",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  properties: {},
};

const project: WritingProject = {
  id: "project-context",
  title: "写作项目",
  status: "修改中",
  updatedAt: "2026-01-01T00:00:00.000Z",
  groups: [{ id: "group-default", title: "文章" }],
  sheets: [sheet],
};

function createActions(): SidebarContextMenuActions {
  return {
    closeSidebarContextMenu: vi.fn(),
    editContextProject: vi.fn(),
    manageContextDocumentProperties: vi.fn(),
    formatContextSheet: vi.fn(),
    editContextProjectGroup: vi.fn(),
    showSidebarContextTargetInFinder: vi.fn().mockResolvedValue(undefined),
    toggleContextArchive: vi.fn(),
    contextArchiveLabel: vi.fn(() => "归档项目"),
    requestDeleteProjectFromContextMenu: vi.fn(),
    requestDeleteProjectGroupFromContextMenu: vi.fn(),
    toggleContextPinned: vi.fn(),
    contextPinnedLabel: vi.fn(() => "置顶"),
    toggleContextFavorite: vi.fn(),
    contextFavoriteLabel: vi.fn(() => "收藏"),
    duplicateContextSheet: vi.fn(),
    requestDeleteSheetFromContextMenu: vi.fn(),
    openContextSheetFunctionRail: vi.fn(),
    openContextSheetWithDefaultApplication: vi.fn().mockResolvedValue(undefined),
  };
}

function createProps(context: SidebarContextMenuProps["context"], actions = createActions()): SidebarContextMenuProps {
  return {
    context,
    actions,
    projects: [project],
    fileManagerName: "访达",
    contextSheetEntries: context.kind === "sheet" ? [{ project, sheet }] : [],
    contextSheetSources: context.kind === "sheet" ? [{ projectId: project.id, groupId: sheet.groupId }] : [],
    onOpenProjectHugoBatchPublish: vi.fn(),
    onOpenProjectHelpCenterSync: vi.fn(),
    onImportMarkdown: vi.fn(),
    onMoveSheets: vi.fn(),
    onOpenMoveSheetDialog: vi.fn(),
    onOpenSheetHelpCenterSync: vi.fn(),
  };
}

describe("SidebarContextMenu", () => {
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
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function renderMenu(props: SidebarContextMenuProps) {
    await act(async () => {
      root.render(
        createElement(
          ContextMenu,
          { open: true },
          createElement(ContextMenuTrigger, null, "触发"),
          createElement(SidebarContextMenu, props),
        ),
      );
    });
  }

  function menuItem(label: string) {
    return [...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((item) => item.textContent?.trim() === label);
  }

  it("keeps the project menu actions and forwards import", async () => {
    const props = createProps({
      path: "/writing-library/project-context",
      label: project.title,
      kind: "project",
      projectId: project.id,
    });
    await renderMenu(props);

    expect(document.body.textContent).toContain("项目设置");
    expect(document.body.textContent).toContain("文稿属性");
    expect(document.body.textContent).toContain("导入 Markdown…");
    expect(document.body.textContent).toContain("在访达中显示");
    expect(document.body.textContent).toContain("删除项目");

    await act(async () => menuItem("导入 Markdown…")?.click());
    expect(props.onImportMarkdown).toHaveBeenCalledWith(project.id);
    expect(props.actions.closeSidebarContextMenu).toHaveBeenCalledOnce();
  });

  it("keeps the single-sheet actions and opens the editor function rail", async () => {
    const props = createProps({
      path: "/writing-library/project-context/文章/right-context.md",
      label: sheet.title,
      kind: "sheet",
      projectId: project.id,
      sheetId: sheet.id,
      sheetIds: [sheet.id],
    });
    await renderMenu(props);

    expect(document.body.textContent).toContain("中文排版优化");
    expect(document.body.textContent).toContain("置顶");
    expect(document.body.textContent).toContain("收藏");
    expect(document.body.textContent).toContain("创建副本");
    expect(document.body.textContent).toContain("查看媒体");
    expect(document.body.textContent).toContain("查找替换");
    expect(document.body.textContent).toContain("查看历史版本");
    expect(document.body.textContent).toContain("使用默认应用打开");
    expect(document.body.textContent).toContain("删除文稿");

    await act(async () => menuItem("查看媒体")?.click());
    expect(props.actions.openContextSheetFunctionRail).toHaveBeenCalledWith("media");
  });
});
