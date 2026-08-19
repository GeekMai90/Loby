// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React DOM、Vitest、写作库项目夹具与 useGlobalSearchNavigation
 * [OUTPUT]: 验证全部范围/项目范围搜索导航、一次性滚动请求和无效结果的无副作用行为
 * [POS]: app 全局搜索导航事务的聚焦回归测试，保护跨 rail 与工作区状态的原子切换
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useGlobalSearchNavigation } from "@/app/useGlobalSearchNavigation";
import type { ProjectFilter } from "@/features/library/model/projectModel";
import type { SidebarMode, WritingProject, WritingSheet } from "@/shared/types";

const draftSheet: WritingSheet = {
  id: "sheet-draft",
  title: "草稿",
  groupId: "group-draft",
  tags: [],
  targetWords: 0,
  description: "",
  body: "# 草稿",
  createdAt: "2026-08-19",
  updatedAt: "2026-08-19",
  properties: {},
};

const publishedSheet: WritingSheet = {
  ...draftSheet,
  id: "sheet-published",
  title: "已发布",
  groupId: "group-published",
  body: "# 已发布",
};

const projects: WritingProject[] = [
  {
    id: "project-a",
    title: "项目 A",
    status: "初稿",
    groups: [
      { id: "group-draft", title: "草稿" },
      { id: "group-published", title: "已发布" },
    ],
    sheets: [draftSheet, publishedSheet],
    updatedAt: "2026-08-19",
  },
];

interface NavigationHarnessProps {
  events: string[];
}

function NavigationHarness({ events }: NavigationHarnessProps) {
  const [activeProjectId, setActiveProjectId] = useState("before-project");
  const [activeSheetId, setActiveSheetId] = useState("before-sheet");
  const [activeGroupId, setActiveGroupId] = useState("before-group");
  const [activeNoteGroupId, setActiveNoteGroupId] = useState("before-note");
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>("library");
  const [projectFilter, setProjectFilter] = useState<ProjectFilter>("recent");
  const [selectedSheetId, setSelectedSheetId] = useState("");
  const [rememberedGroup, setRememberedGroup] = useState("");
  const navigation = useGlobalSearchNavigation({
    projects,
    onSearchClose: () => events.push("close"),
    onSheetFiltersReset: () => events.push("reset"),
    onSheetListRailShow: () => events.push("show-list"),
    onSingleSheetSelect: (sheetId) => {
      events.push("select-list");
      setSelectedSheetId(sheetId);
    },
    onSheetListActivate: () => events.push("activate-list"),
    onActiveProjectChange: setActiveProjectId,
    onActiveSheetChange: setActiveSheetId,
    onActiveNoteGroupChange: setActiveNoteGroupId,
    onProjectFilterChange: setProjectFilter,
    onSidebarModeChange: setSidebarMode,
    onActiveGroupChange: setActiveGroupId,
    onRememberProjectGroup: (projectId, groupId) => setRememberedGroup(`${projectId}:${groupId}`),
  });

  return createElement(
    "section",
    null,
    createElement("button", { "data-testid": "open-all", onClick: () => navigation.openGlobalSearchResult("sheet-published", "all") }),
    createElement("button", {
      "data-testid": "open-project",
      onClick: () => navigation.openGlobalSearchResult("sheet-published", "project"),
    }),
    createElement("button", { "data-testid": "open-missing", onClick: () => navigation.openGlobalSearchResult("missing", "all") }),
    createElement(
      "output",
      { "data-testid": "selection" },
      `${activeProjectId}|${activeGroupId}|${activeSheetId}|${activeNoteGroupId}|${sidebarMode}|${projectFilter}`,
    ),
    createElement("output", { "data-testid": "selected-sheet" }, selectedSheetId),
    createElement("output", { "data-testid": "remembered-group" }, rememberedGroup),
    createElement("output", { "data-testid": "scroll-request" }, JSON.stringify(navigation.sheetScrollRequest)),
  );
}

describe("useGlobalSearchNavigation", () => {
  let container: HTMLDivElement;
  let root: Root;
  let events: string[];

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    events = [];
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
    container.remove();
  });

  async function renderHarness() {
    await act(async () => root.render(createElement(NavigationHarness, { events })));
  }

  async function click(testId: string) {
    await act(async () => container.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`)?.click());
  }

  it("opens an all-library result, selects it, and creates a monotonic list scroll request", async () => {
    await renderHarness();
    await click("open-all");

    expect(events).toEqual(["close", "reset", "show-list", "select-list", "activate-list"]);
    expect(container.querySelector('[data-testid="selection"]')?.textContent).toBe(
      "project-a|group-published|sheet-published||library|active",
    );
    expect(container.querySelector('[data-testid="selected-sheet"]')?.textContent).toBe("sheet-published");
    expect(container.querySelector('[data-testid="scroll-request"]')?.textContent).toBe(
      JSON.stringify({ sheetId: "sheet-published", requestId: 1 }),
    );

    await click("open-all");
    expect(container.querySelector('[data-testid="scroll-request"]')?.textContent).toBe(
      JSON.stringify({ sheetId: "sheet-published", requestId: 2 }),
    );
  });

  it("opens a project-scoped result in project mode and remembers its group without requesting a scroll", async () => {
    await renderHarness();
    await click("open-project");

    expect(container.querySelector('[data-testid="selection"]')?.textContent).toBe(
      "project-a|group-published|sheet-published||project|active",
    );
    expect(container.querySelector('[data-testid="remembered-group"]')?.textContent).toBe("project-a:group-published");
    expect(container.querySelector('[data-testid="scroll-request"]')?.textContent).toBe("null");
  });

  it("ignores a stale search result without closing search or mutating workspace state", async () => {
    await renderHarness();
    await click("open-missing");

    expect(events).toEqual([]);
    expect(container.querySelector('[data-testid="selection"]')?.textContent).toBe(
      "before-project|before-group|before-sheet|before-note|library|recent",
    );
    expect(container.querySelector('[data-testid="selected-sheet"]')?.textContent).toBe("");
  });
});
