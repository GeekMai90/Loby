// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React DOM、Vitest、ProjectPublishingSettings、项目草稿与发布目标 registry
 * [OUTPUT]: 验证项目只保存目标引用、Starlight 分组映射可见以及一对一占用提示
 * [POS]: publishing 项目绑定界面的核心交互回归测试
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { act, createElement, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { ProjectPublishingSettings } from "@/features/publishing/components/ProjectPublishingSettings";
import { createDefaultGitHubDocsTarget } from "@/features/publishing/model/publishingTargets";
import type { NewProjectDraft } from "@/features/library/constants/projectAppearance";
import type { WritingProject } from "@/shared/types";

describe("ProjectPublishingSettings", () => {
  afterEach(() => document.body.replaceChildren());

  it("shows the bound Starlight target and keeps repository parameters out of the project draft", async () => {
    const target = readyDocsTarget();
    const project = sampleProject({
      targetId: target.id,
      groupMappings: [
        { groupId: "group-default", directory: "", enabled: false },
        { groupId: "group-guide", directory: "guide", enabled: true },
      ],
    });
    const draft: NewProjectDraft = {
      title: project.title,
      icon: "book",
      iconColor: "#007aff",
      publishingTargetId: target.id,
      publishingGroupMappings: project.publishingBinding?.groupMappings,
    };
    const { container, root } = await renderSettings(project, [project], draft, target);

    expect(container.querySelector('[aria-label="项目发布目标"]')?.textContent).toContain("落笔帮助中心");
    expect(container.textContent).toContain("分组与文件夹");
    expect(container.textContent).toContain("开始使用");
    expect(container.querySelector<HTMLInputElement>('input[value="guide"]')).not.toBeNull();
    expect(JSON.stringify(draft)).not.toContain("repository");

    await act(async () => root.unmount());
  });

  it("explains when every target is already bound to another project", async () => {
    const target = readyDocsTarget();
    const project = sampleProject();
    const other = { ...sampleProject({ targetId: target.id, groupMappings: [] }), id: "project-other", title: "另一个项目" };
    const draft: NewProjectDraft = { title: project.title, icon: "book", iconColor: "#007aff", publishingTargetId: "" };
    const { container, root } = await renderSettings(project, [project, other], draft, target);

    expect(container.textContent).toContain("当前发布目标均已绑定到其他项目");

    await act(async () => root.unmount());
  });
});

async function renderSettings(
  project: WritingProject,
  projects: WritingProject[],
  initialDraft: NewProjectDraft,
  target: ReturnType<typeof readyDocsTarget>,
) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  function Harness() {
    const [draft, setDraft] = useState(initialDraft);
    return createElement(ProjectPublishingSettings, {
      project,
      projects,
      targets: { version: 1, targets: [target] },
      targetsReady: true,
      draft,
      onDraftChange: setDraft,
    });
  }
  await act(async () => root.render(createElement(Harness)));
  return { container, root };
}

function readyDocsTarget() {
  return {
    ...createDefaultGitHubDocsTarget(),
    id: "github-docs-help",
    siteName: "落笔帮助中心",
    repository: "GeekMai90/loby-help-center",
    siteUrl: "https://loby-help.geekmailab.com",
  };
}

function sampleProject(publishingBinding?: WritingProject["publishingBinding"]): WritingProject {
  return {
    id: "project-help",
    title: "落笔帮助中心",
    status: "构思",
    updatedAt: "2026-07-30",
    publishingBinding,
    groups: [
      { id: "group-default", title: "待整理" },
      { id: "group-guide", title: "开始使用" },
    ],
    sheets: [],
  };
}
