// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React DOM、Vitest 与 ProjectDraftDialogsHost
 * [OUTPUT]: 验证项目/分组草稿 surface 只在任一草稿打开时加载，并保留注入的提交边界
 * [POS]: library project draft surface host 的聚焦回归测试，保护 lazy 迁移不改变创建/编辑入口
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NewProjectDraft } from "@/features/library/constants/projectAppearance";
import { ProjectDraftDialogsHost, type ProjectDraftDialogsHostProps } from "@/features/library/components/ProjectDraftDialogsHost";

vi.mock("@/features/library/components/ProjectDraftDialogs", () => ({
  ProjectDraftDialogs: ({ onSubmitProject }: { onSubmitProject: () => void }) =>
    createElement("button", { "data-testid": "project-draft-dialog", onClick: onSubmitProject }, "项目草稿"),
}));

function createProps(overrides: Partial<ProjectDraftDialogsHostProps> = {}): ProjectDraftDialogsHostProps {
  return {
    projectDialogOpen: true,
    groupDialogOpen: false,
    editingProjectId: "",
    editingGroupId: "",
    projectDraft: {} as NewProjectDraft,
    groupDraft: {} as NewProjectDraft,
    onCloseProject: vi.fn(),
    onSubmitProject: vi.fn(),
    onProjectDraftChange: vi.fn(),
    onCloseGroup: vi.fn(),
    onSubmitGroup: vi.fn(),
    onGroupDraftChange: vi.fn(),
    ...overrides,
  };
}

describe("ProjectDraftDialogsHost", () => {
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

  async function renderHost(props: ProjectDraftDialogsHostProps) {
    await act(async () => {
      root.render(createElement(ProjectDraftDialogsHost, props));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  it("does not mount while both draft surfaces are closed", async () => {
    await renderHost(createProps({ projectDialogOpen: false }));
    expect(document.body.querySelector('[data-testid="project-draft-dialog"]')).toBeNull();
  });

  it("passes the project submit boundary to the lazy surface", async () => {
    const onSubmitProject = vi.fn();
    await renderHost(createProps({ onSubmitProject }));
    document.body.querySelector<HTMLButtonElement>('[data-testid="project-draft-dialog"]')?.click();
    expect(onSubmitProject).toHaveBeenCalledOnce();
  });
});
