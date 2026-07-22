// @vitest-environment happy-dom

import { act, createElement, useMemo, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectGroup, SidebarMode, WritingProject, WritingSheet } from "@/shared/types";
import {
  createDefaultInboxProject,
  createDefaultNotesProject,
  getVisibleProjectGroups,
  PROJECT_ALL_GROUP_ID,
  type ProjectFilter,
} from "@/features/library/model/projectModel";
import type { WorkspaceSelectionSnapshot } from "@/features/library/model/workspaceSelection";
import { useWorkspaceNavigation } from "@/features/library/hooks/useWorkspaceNavigation";

const firstGroup: ProjectGroup = { id: "group-default", title: "待整理", icon: "inbox", iconColor: "#007aff", description: "" };
const secondGroup: ProjectGroup = {
  id: "group-published",
  title: "已发布",
  icon: "article",
  iconColor: "#007aff",
  description: "",
};

function sheet(id: string, groupId: string): WritingSheet {
  return {
    id,
    title: id,
    groupId,
    status: "构思",
    targetWords: 1000,
    summary: "",
    body: `# ${id}`,
    updatedAt: "2026-07-20",
  };
}

function project(id: string, sheets = [sheet(`${id}-draft`, firstGroup.id), sheet(`${id}-published`, secondGroup.id)]): WritingProject {
  return {
    id,
    title: id,
    description: "",
    status: "构思",
    targetPlatform: "公众号",
    targetWords: 1000,
    tags: [],
    groups: [firstGroup, secondGroup],
    sheets,
    updatedAt: "2026-07-20",
  };
}

interface NavigationHarnessProps {
  projects: WritingProject[];
  initialSelection: WorkspaceSelectionSnapshot;
}

function NavigationHarness({ projects, initialSelection }: NavigationHarnessProps) {
  const [activeProjectId, setActiveProjectId] = useState(initialSelection.activeProjectId);
  const [activeSheetId, setActiveSheetId] = useState(initialSelection.activeSheetId);
  const [activeGroupId, setActiveGroupId] = useState(initialSelection.activeGroupId);
  const [activeNoteGroupId, setActiveNoteGroupId] = useState(initialSelection.activeNoteGroupId);
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>(initialSelection.sidebarMode);
  const [projectFilter, setProjectFilter] = useState<ProjectFilter>(initialSelection.projectFilter);
  const [activeGroupIdsByProject, setActiveGroupIdsByProject] = useState(initialSelection.activeGroupIdsByProject);
  const [railOpenCount, setRailOpenCount] = useState(0);
  const [filterResetCount, setFilterResetCount] = useState(0);
  const inboxProject = useMemo(() => createDefaultInboxProject(), []);
  const notesProject = useMemo(() => createDefaultNotesProject(), []);
  const activeProject = projects.find((item) => item.id === activeProjectId);
  const visibleProjectGroups = useMemo(() => (activeProject ? getVisibleProjectGroups(activeProject) : []), [activeProject]);
  const selectedVisibleGroup = visibleProjectGroups.find((group) => group.id === activeGroupId);
  const selection: WorkspaceSelectionSnapshot = {
    activeProjectId,
    activeSheetId,
    activeGroupId,
    activeNoteGroupId,
    sidebarMode,
    projectFilter,
    activeGroupIdsByProject,
  };
  const navigation = useWorkspaceNavigation({
    selection,
    projects,
    activeProject,
    inboxProject,
    notesProject,
    noteGroups: notesProject.groups ?? [],
    selectedNoteGroupId: activeNoteGroupId,
    visibleProjectGroups,
    selectedVisibleGroup,
    filteredProjects: projects,
    sourceSheets: activeProject?.sheets ?? [],
    onActiveProjectChange: setActiveProjectId,
    onActiveSheetChange: setActiveSheetId,
    onActiveGroupChange: setActiveGroupId,
    onActiveNoteGroupChange: setActiveNoteGroupId,
    onSidebarModeChange: setSidebarMode,
    onProjectFilterChange: setProjectFilter,
    onActiveGroupIdsByProjectChange: setActiveGroupIdsByProject,
    onShowSheetListRail: () => setRailOpenCount((current) => current + 1),
    onResetSheetFilters: () => setFilterResetCount((current) => current + 1),
  });

  return createElement(
    "section",
    null,
    createElement("button", { "data-testid": "enter-b", onClick: () => navigation.enterProject(projects[1]) }, "enter"),
    createElement("button", { "data-testid": "select-group", onClick: () => navigation.selectProjectGroup(firstGroup.id) }, "group"),
    createElement("button", { "data-testid": "select-all", onClick: () => navigation.selectProjectGroup(PROJECT_ALL_GROUP_ID) }, "all"),
    createElement("button", { "data-testid": "select-sheet", onClick: () => navigation.selectSheet("project-a-published") }, "sheet"),
    createElement(
      "output",
      { "data-testid": "selection" },
      `${activeProjectId}|${activeGroupId}|${activeSheetId}|${sidebarMode}|${projectFilter}`,
    ),
    createElement("output", { "data-testid": "remembered" }, JSON.stringify(activeGroupIdsByProject)),
    createElement("output", { "data-testid": "actions" }, `${railOpenCount}|${filterResetCount}`),
  );
}

describe("useWorkspaceNavigation", () => {
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

  async function renderHarness(projects: WritingProject[], initialSelection: WorkspaceSelectionSnapshot) {
    await act(async () => root.render(createElement(NavigationHarness, { projects, initialSelection })));
  }

  it("applies project, group, and cross-project sheet navigation through React state", async () => {
    const projects = [project("project-a"), project("project-b")];
    await renderHarness(projects, {
      activeProjectId: "project-a",
      activeSheetId: "project-a-draft",
      activeGroupId: firstGroup.id,
      activeNoteGroupId: "",
      sidebarMode: "library",
      projectFilter: "active",
      activeGroupIdsByProject: { "project-b": secondGroup.id },
    });

    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="enter-b"]')!.click());
    expect(container.querySelector('[data-testid="selection"]')?.textContent).toBe(
      "project-b|group-published|project-b-published|project|active",
    );

    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="select-group"]')!.click());
    expect(container.querySelector('[data-testid="selection"]')?.textContent).toBe(
      "project-b|group-default|project-b-draft|project|active",
    );
    expect(container.querySelector('[data-testid="remembered"]')?.textContent).toContain('"project-b":"group-default"');

    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="select-all"]')!.click());
    expect(container.querySelector('[data-testid="selection"]')?.textContent).toBe(
      `project-b|${PROJECT_ALL_GROUP_ID}|project-b-draft|project|active`,
    );
    expect(container.querySelector('[data-testid="remembered"]')?.textContent).toContain(`"project-b":"${PROJECT_ALL_GROUP_ID}"`);

    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="select-sheet"]')!.click());
    expect(container.querySelector('[data-testid="selection"]')?.textContent).toBe(
      "project-a|group-published|project-a-published|project|active",
    );
    expect(container.querySelector('[data-testid="actions"]')?.textContent).toBe("3|3");
  });

  it("repairs a removed project group and sheet through the rendered coordinator", async () => {
    const remainingProject = project("project-a", [sheet("project-a-published", secondGroup.id)]);
    remainingProject.groups = [secondGroup];
    await renderHarness([remainingProject], {
      activeProjectId: "project-a",
      activeSheetId: "removed-sheet",
      activeGroupId: firstGroup.id,
      activeNoteGroupId: "",
      sidebarMode: "project",
      projectFilter: "active",
      activeGroupIdsByProject: {},
    });

    expect(container.querySelector('[data-testid="selection"]')?.textContent).toBe(
      "project-a|group-published|project-a-published|project|active",
    );
    expect(container.querySelector('[data-testid="remembered"]')?.textContent).toContain('"project-a":"group-published"');
  });
});
