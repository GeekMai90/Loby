// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React DOM、Vitest、项目发布设置 host 与最小项目草稿契约
 * [OUTPUT]: 验证项目发布设置的 lazy 边界由 publishing feature 持有，并完整透传项目上下文
 * [POS]: publishing 项目设置 surface host 的组合回归测试
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NewProjectDraft } from "@/features/library/constants/projectAppearance";
import type { ProjectPublishingSettingsProps } from "@/features/publishing/components/ProjectPublishingSettings";
import { ProjectPublishingSettingsHost } from "@/features/publishing/components/ProjectPublishingSettingsHost";
import type { WritingProject } from "@/shared/types";

vi.mock("@/features/publishing/components/ProjectPublishingSettings", () => ({
  ProjectPublishingSettings: ({ project, targetsReady }: ProjectPublishingSettingsProps) =>
    createElement(
      "div",
      { "data-testid": "project-publishing-settings", "data-project-id": project.id },
      targetsReady ? "ready" : "not-ready",
    ),
}));

describe("ProjectPublishingSettingsHost", () => {
  afterEach(() => document.body.replaceChildren());

  it("keeps the publishing settings lazy boundary inside the feature", async () => {
    const project = { id: "project-1", title: "示例项目" } as WritingProject;
    const props: ProjectPublishingSettingsProps = {
      project,
      projects: [project],
      targets: { version: 1, targets: [] },
      targetsReady: true,
      draft: { title: project.title, icon: "book", iconColor: "#007aff", publishingTargetId: "" } as NewProjectDraft,
      onDraftChange: vi.fn(),
    };
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => root.render(createElement(ProjectPublishingSettingsHost, props)));

    expect(container.querySelector('[data-testid="project-publishing-settings"]')?.getAttribute("data-project-id")).toBe(project.id);
    expect(container.textContent).toContain("ready");

    await act(async () => root.unmount());
  });
});
