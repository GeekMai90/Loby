// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React DOM、Vitest、帮助中心同步 API mock 与 HelpCenterSyncDialog
 * [OUTPUT]: 验证单篇文稿确认、共享打字机进度、成功链接及 GitHub 设置错误分流
 * [POS]: publishing 的 GitHub 文档站同步集成测试，保护两阶段交互、native 返回链接与动态站点出口
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HelpCenterSyncDialog } from "@/features/publishing/components/HelpCenterSyncDialog";
import { createDefaultGitHubDocsTarget } from "@/features/publishing/model/publishingTargets";
import type { HelpCenterSyncProgress, HelpCenterSyncResult } from "@/features/publishing/model/api";
import type { WritingProject } from "@/shared/types";

const { syncHelpCenterMock } = vi.hoisted(() => ({ syncHelpCenterMock: vi.fn() }));

vi.mock("@/features/publishing/model/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/features/publishing/model/api")>();
  return {
    ...original,
    isDesktopPublishingAvailable: () => true,
    syncHelpCenter: syncHelpCenterMock,
  };
});

describe("HelpCenterSyncDialog", () => {
  let root: Root | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  });

  afterEach(async () => {
    if (root) await act(async () => root?.unmount());
    root = null;
    document.body.replaceChildren();
  });

  it("uses the shared two-phase flow and exposes the returned document URL plus configured website", async () => {
    let finishSync: ((result: HelpCenterSyncResult) => void) | undefined;
    let reportProgress: ((progress: HelpCenterSyncProgress) => void) | undefined;
    syncHelpCenterMock.mockImplementation(
      (_request, onProgress?: (progress: HelpCenterSyncProgress) => void) =>
        new Promise<HelpCenterSyncResult>((resolve) => {
          finishSync = resolve;
          reportProgress = onProgress;
        }),
    );
    root = await renderDialog();

    expect(document.querySelector("[role='dialog'] h2")?.textContent).toBe("同步到落笔帮助中心");
    expect(document.body.textContent).toContain("认识落笔");
    expect(document.body.textContent).toContain("GeekMai90/loby-help-center · main");
    expect(document.body.textContent).not.toContain("同步当前文稿");
    expect(findButton("同步")?.disabled).toBe(false);

    await clickButton("同步");

    expect(document.querySelector(".publish-typewriter-loader .typewriter .keyboard")).not.toBeNull();
    expect(document.body.textContent).toContain("正在检查 GitHub 连接与仓库权限…");
    expect(findButton("取消")?.disabled).toBe(true);
    expect(findButton("同步中…")?.disabled).toBe(true);

    await act(async () => reportProgress?.({ stage: "packaging", completed: 0, total: 1 }));
    expect(document.body.textContent).toContain("正在整理文稿与图片 1/1…");

    await act(async () =>
      finishSync?.({
        commitSha: "1234567890abcdef",
        changed: true,
        syncedCount: 1,
        deletedCount: 0,
        documents: [
          {
            sourceId: sheetId,
            slug: "0123456789abcdefghjkmnpqrs",
            url: "https://loby-help.geekmailab.com/0123456789abcdefghjkmnpqrs/",
            sourceHash: "hash",
          },
        ],
      }),
    );

    expect(document.body.textContent).toContain("同步成功");
    expect(document.body.textContent).toContain("《认识落笔》已同步到落笔帮助中心");
    expect(link("打开文稿")?.href).toBe("https://loby-help.geekmailab.com/0123456789abcdefghjkmnpqrs/");
    expect(link("打开网站")?.href).toBe("https://loby-help.geekmailab.com/");
    expect(findButton("完成")?.disabled).toBe(false);
  });

  it("routes GitHub authorization failures to publishing settings", async () => {
    const onOpenSettings = vi.fn();
    const onOpenChange = vi.fn();
    syncHelpCenterMock.mockRejectedValue(new Error("当前 GitHub 仓库不存在或尚未授权，请在设置中管理仓库权限。"));
    root = await renderDialog({ onOpenSettings, onOpenChange });

    await clickButton("同步");

    expect(document.body.textContent).toContain("需要完成 GitHub 设置");
    await clickButton("前往设置");
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onOpenSettings).toHaveBeenCalledOnce();
  });

  it("shows update when the current target already has a document publication", async () => {
    root = await renderDialog({}, sheetId, publishedProject);

    expect(findButton("更新")?.disabled).toBe(false);
    expect(findButton("同步")).toBeUndefined();
  });

  it("preserves project synchronization cleanup as an explicit opt-in", async () => {
    root = await renderDialog({}, null);

    expect(document.querySelector("[role='dialog'] h2")?.textContent).toBe("同步整个项目到落笔帮助中心");
    expect(document.body.textContent).toContain("清理远端缺失文稿");
    expect(document.body.textContent).toContain("仅清理本项目曾声明的文稿");
    expect(document.querySelector<HTMLButtonElement>('[aria-label="清理远端缺失文稿"]')?.getAttribute("data-state")).toBe("unchecked");
    expect(findButton("同步整个项目")?.disabled).toBe(false);
  });

  async function renderDialog(
    overrides: { onOpenSettings?: () => void; onOpenChange?: (open: boolean) => void } = {},
    selectedSheetId: string | null = sheetId,
    sourceProject: WritingProject = project,
  ): Promise<Root> {
    const container = document.createElement("div");
    document.body.append(container);
    const nextRoot = createRoot(container);
    await act(async () => {
      nextRoot.render(
        createElement(HelpCenterSyncDialog, {
          open: true,
          libraryPath: "/tmp/loby-library",
          project: sourceProject,
          target,
          sheetId: selectedSheetId ?? undefined,
          onOpenChange: overrides.onOpenChange ?? vi.fn(),
          onOpenSettings: overrides.onOpenSettings ?? vi.fn(),
          onProjectChange: vi.fn(),
        }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    return nextRoot;
  }
});

async function clickButton(label: string) {
  const button = findButton(label);
  expect(button, `button ${label}`).toBeDefined();
  await act(async () => {
    button?.click();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function findButton(label: string): HTMLButtonElement | undefined {
  return [...document.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === label);
}

function link(label: string): HTMLAnchorElement | undefined {
  return [...document.querySelectorAll<HTMLAnchorElement>("a")].find((anchor) => anchor.textContent?.includes(label));
}

const sheetId = "sheet-0123456789abcdefghjkmnpqrs";
const project: WritingProject = {
  id: "project-help",
  title: "落笔帮助中心",
  status: "待发布",
  projectGoal: { enabled: false, unit: "words", target: 0 },
  groups: [{ id: "group-start", title: "开始使用" }],
  sheets: [
    {
      id: sheetId,
      title: "认识落笔",
      groupId: "group-start",
      tags: [],
      targetWords: 0,
      description: "",
      body: "# 认识落笔\n\n正文",
      createdAt: "2026-07-30",
      updatedAt: "2026-07-30",
      properties: {},
    },
  ],
  publishingBinding: {
    targetId: "github-docs-help",
    groupMappings: [{ groupId: "group-start", directory: "开始使用", enabled: true }],
  },
  updatedAt: "2026-07-30",
};

const target = {
  ...createDefaultGitHubDocsTarget(),
  id: "github-docs-help",
  enabled: true,
  siteName: "落笔帮助中心",
  repository: "GeekMai90/loby-help-center",
  siteUrl: "https://loby-help.geekmailab.com",
};

const publishedProject: WritingProject = {
  ...project,
  sheets: project.sheets.map((sheet) => ({
    ...sheet,
    publications: {
      [target.id]: {
        targetKind: "githubDocsSite",
        sourceId: sheet.id,
        slug: "0123456789abcdefghjkmnpqrs",
        url: "https://loby-help.geekmailab.com/0123456789abcdefghjkmnpqrs/",
        lastCommitSha: "previous12345678",
        lastPublishedAt: "2026-07-29",
        sourceHash: "previous-hash",
        draft: false,
      },
    },
  })),
};
