// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React DOM、Vitest、发布目标模型与 PublishingTargetDialog
 * [OUTPUT]: 验证 Hugo 与 Starlight 目标分别进入对应的 lazy 对话框 surface
 * [POS]: publishing target host 的聚焦回归测试，保护 App 拆分后目标分流与文稿上下文传递
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WritingProject } from "@/shared/types";
import { createDefaultGitHubBlogTarget, createDefaultGitHubDocsTarget } from "@/features/publishing/model/publishingTargets";
import { PublishingTargetDialog, type PublishingTargetDialogProps } from "@/features/publishing/components/PublishingTargetDialog";

vi.mock("@/features/publishing/components/HugoBatchPublishDialog", () => ({
  HugoBatchPublishDialog: ({ project }: { project: WritingProject }) =>
    createElement("div", { "data-testid": "hugo-target-dialog" }, project.title),
}));

vi.mock("@/features/publishing/components/HelpCenterSyncDialog", () => ({
  HelpCenterSyncDialog: ({ project, sheetId }: { project: WritingProject; sheetId?: string }) =>
    createElement("div", { "data-testid": "docs-target-dialog" }, `${project.title}:${sheetId ?? "project"}`),
}));

const projectBase: WritingProject = {
  id: "project-publishing",
  title: "发布项目",
  status: "修改中",
  updatedAt: "2026-01-01T00:00:00.000Z",
  groups: [{ id: "group-default", title: "文章" }],
  sheets: [],
};

function readyBlogTarget() {
  return { ...createDefaultGitHubBlogTarget(), repository: "owner/blog", siteUrl: "https://blog.example.com" };
}

function readyDocsTarget() {
  return { ...createDefaultGitHubDocsTarget(), repository: "owner/docs", siteUrl: "https://docs.example.com" };
}

function createProps(target: ReturnType<typeof readyBlogTarget> | ReturnType<typeof readyDocsTarget>): PublishingTargetDialogProps {
  const project = { ...projectBase, publishingBinding: { targetId: target.id, groupMappings: [] } };
  return {
    request: { projectId: project.id, targetId: target.id, sheetId: "sheet-publishing" },
    projects: [project],
    publishingTargets: { version: 1, targets: [target] },
    libraryPath: "/writing-library",
    onClose: vi.fn(),
    onOpenSettings: vi.fn(),
    onProjectChange: vi.fn(),
  };
}

describe("PublishingTargetDialog", () => {
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
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  async function renderDialog(props: PublishingTargetDialogProps) {
    await act(async () => {
      root.render(createElement(PublishingTargetDialog, props));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  it("routes a ready Hugo target to the blog dialog", async () => {
    await renderDialog(createProps(readyBlogTarget()));
    expect(document.body.querySelector('[data-testid="hugo-target-dialog"]')?.textContent).toBe("发布项目");
    expect(document.body.querySelector('[data-testid="docs-target-dialog"]')).toBeNull();
  });

  it("routes a ready Starlight target and preserves the sheet context", async () => {
    await renderDialog(createProps(readyDocsTarget()));
    expect(document.body.querySelector('[data-testid="docs-target-dialog"]')?.textContent).toBe("发布项目:sheet-publishing");
    expect(document.body.querySelector('[data-testid="hugo-target-dialog"]')).toBeNull();
  });
});
