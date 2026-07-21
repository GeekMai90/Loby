import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createProjectFromTemplate } from "../lib/projectCreation";
import { LibraryRail } from "./LibraryRail";

describe("LibraryRail", () => {
  it("uses a reversed LogOut icon for returning from a project", () => {
    const project = createProjectFromTemplate("blank", { title: "测试项目", icon: "library", iconColor: "#007aff" });
    const noop = vi.fn();
    const html = renderToStaticMarkup(
      createElement(LibraryRail, {
        active: true,
        open: true,
        sidebarMode: "project",
        activeProject: project,
        projectFilter: "active",
        projectsOpen: true,
        notesOpen: true,
        filteredProjects: [project],
        notesGroups: [],
        projectGroups: project.groups ?? [],
        resolvedActiveGroupId: "",
        activeNoteGroupId: "",
        sheetDragActive: false,
        writingCheckIns: [],
        writingProjects: [project],
        resolvedAppTheme: "light",
        onWindowDragStart: noop,
        onWindowToolbarDoubleClick: noop,
        onCreateProject: noop,
        onCollapse: noop,
        onProjectFilterChange: noop,
        onProjectsOpenChange: noop,
        onNotesOpenChange: noop,
        onEnterProject: noop,
        onProjectContextMenu: noop,
        onSelectNoteGroup: noop,
        onNoteGroupContextMenu: noop,
        onCreateNoteGroup: noop,
        onReorderProjects: noop,
        onReorderNoteGroups: noop,
        onBackToLibrary: noop,
        onEditProject: noop,
        onCreateProjectGroup: noop,
        onSelectProjectGroup: noop,
        onReorderProjectGroups: noop,
        onOpenSettings: noop,
        onTemporaryAppThemeChange: noop,
        onActivate: noop,
      }),
    );

    expect(html).toContain('aria-label="返回项目列表"');
    expect(html).toContain("lucide-log-out");
    expect(html).toContain("[transform:scaleX(-1)]");
  });
});
