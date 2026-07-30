/**
 * [INPUT]: 依赖 React DOM、Vitest、通用项目创建模型与 LibraryRail
 * [OUTPUT]: 验证项目导航场景、返回图标兼拖拽返回目标、临时固定按钮和底部边界的渲染契约
 * [POS]: 写作库 feature 的导航容器回归测试，保护旧 PR 动效迁移后的可访问结构
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LibraryRail } from "@/features/library/components/LibraryRail";
import { createWritingProject } from "@/features/library/model/projectCreation";

describe("LibraryRail", () => {
  it("renders project mode as an accessible animated scene with the reversed return icon", () => {
    const project = createWritingProject({ title: "测试项目", icon: "library", iconColor: "#007aff" });
    const noop = vi.fn();
    const html = renderToStaticMarkup(
      createElement(LibraryRail, {
        active: true,
        open: true,
        temporary: true,
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
        sheetDragActive: true,
        writingCheckIns: [],
        writingProjects: [project],
        resolvedAppTheme: "light",
        developerGalleryPage: null,
        onWindowDragStart: noop,
        onWindowToolbarDoubleClick: noop,
        onCreateProject: noop,
        onCollapse: noop,
        onPin: noop,
        onTemporaryPointerEnter: noop,
        onTemporaryPointerLeave: noop,
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
        onDeveloperGalleryPageChange: noop,
        onTemporaryAppThemeChange: noop,
        onActivate: noop,
      }),
    );

    expect(html).toContain('data-sidebar-mode="project"');
    expect(html).toContain('aria-label="返回项目列表"');
    expect(html.match(/data-sheet-drag-return-library/g)).toHaveLength(1);
    expect(html).not.toContain("sheet-drag-return-zone");
    expect(html).toContain("lucide-log-out");
    expect(html).toContain("[transform:scaleX(-1)]");
    expect(html).toContain('aria-label="固定展开导航栏"');
    expect(html).toContain("lucide-panel-left-open");
  });
});
