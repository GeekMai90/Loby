import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_USER_GROUP_ID, PROJECT_ALL_GROUP_ID } from "@/features/library/model/projectModel";
import { ProjectGroupsSection } from "@/features/library/components/ProjectGroupsSection";

describe("ProjectGroupsSection", () => {
  it("renders All as a virtual filter before persisted project groups", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectGroupsSection, {
        active: true,
        projectId: "project-1",
        projectGroups: [{ id: DEFAULT_USER_GROUP_ID, title: "待整理", icon: "inbox", iconColor: "#007aff" }],
        resolvedActiveGroupId: PROJECT_ALL_GROUP_ID,
        onSelectProjectGroup: vi.fn(),
        onProjectGroupContextMenu: vi.fn(),
        onStartPointerDrag: vi.fn(),
        onUpdatePointerDrag: vi.fn(),
        onFinishPointerDrag: vi.fn(),
        onCancelPointerDrag: vi.fn(),
        onSuppressClickAfterDrag: vi.fn(() => false),
        railDropClass: vi.fn(() => ""),
      }),
    );

    expect(html.indexOf("全部")).toBeLessThan(html.indexOf("待整理"));
    expect(html).toContain('aria-current="page"');
    expect(html).toContain(`data-sheet-move-group-id="${DEFAULT_USER_GROUP_ID}"`);
    expect(html).not.toContain(PROJECT_ALL_GROUP_ID);
  });

  it("keeps long group titles on one line with a hover title", () => {
    const groupTitle = "麦先生说《道德经》与现代写作实践";
    const html = renderToStaticMarkup(
      createElement(ProjectGroupsSection, {
        active: true,
        projectId: "project-1",
        projectGroups: [{ id: "group-long", title: groupTitle, icon: "brain", iconColor: "#007aff" }],
        resolvedActiveGroupId: "group-long",
        onSelectProjectGroup: vi.fn(),
        onProjectGroupContextMenu: vi.fn(),
        onStartPointerDrag: vi.fn(),
        onUpdatePointerDrag: vi.fn(),
        onFinishPointerDrag: vi.fn(),
        onCancelPointerDrag: vi.fn(),
        onSuppressClickAfterDrag: vi.fn(() => false),
        railDropClass: vi.fn(() => ""),
      }),
    );

    expect(html).toContain('class="min-w-0 flex-1 truncate text-left" title="麦先生说《道德经》与现代写作实践"');
  });
});
