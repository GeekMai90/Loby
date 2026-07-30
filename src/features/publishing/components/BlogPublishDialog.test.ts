// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React DOM、Vitest、GitHub 发布 API mock 与 BlogPublishDialog
 * [OUTPUT]: 验证 GitHub 确认态即时操作、权限检查进度、错误恢复及元数据回写后的成功状态稳定性
 * [POS]: publishing 的应用级 GitHub 目标发布集成测试，保护确认、预检、恢复与按目标成功回写之间的状态边界
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BlogPublishDialog } from "@/features/publishing/components/BlogPublishDialog";
import type { PublishingTargetPublication, WritingProject, WritingSheet } from "@/shared/types";
import { createDefaultGitHubBlogTarget } from "@/features/publishing/model/publishingTargets";

const { publishBlogMock, writeTextMock } = vi.hoisted(() => ({
  publishBlogMock: vi.fn(),
  writeTextMock: vi.fn(),
}));

vi.mock("@/features/publishing/model/api", () => ({
  isDesktopPublishingAvailable: () => true,
  publishBlogPost: publishBlogMock,
}));

describe("BlogPublishDialog", () => {
  let root: Root | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    writeTextMock.mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: writeTextMock } });
  });

  afterEach(async () => {
    if (root) await act(async () => root?.unmount());
    root = null;
    document.body.replaceChildren();
  });

  it("keeps the success view after publishing metadata updates the parent sheet", async () => {
    let finishPublish: ((result: PublishResult) => void) | undefined;
    publishBlogMock.mockImplementation(
      (_request, onProgress?: (progress: { stage: string }) => void) =>
        new Promise<PublishResult>((resolve) => {
          finishPublish = resolve;
          onProgress?.({ stage: "checkingAuthorization" });
        }),
    );
    root = await renderDialog();

    expect(document.querySelector("[role='dialog'] h2")?.textContent).toBe("发布到麦先生说博客");
    expect(document.body.textContent).not.toContain("GitHub 发布当前文稿");
    expect(document.body.textContent).not.toContain("文章地址 ID");
    expect(document.body.textContent).not.toContain("example.com/posts/");
    expect(document.querySelector("[role='tablist'][aria-label='GitHub 发布可见范围']")).not.toBeNull();
    expect(document.body.textContent).toContain("可见范围");
    expect(document.body.textContent).not.toContain("所有人可查看");
    expect(document.body.textContent).toContain("owner/site · main");
    expect(findButton("发布")?.disabled).toBe(false);

    await clickButton("私密");

    expect(document.body.textContent).not.toContain("仅自己可见");
    expect(findButton("发布")?.disabled).toBe(false);
    expect(document.body.textContent).not.toContain("保存草稿");

    await clickButton("发布");

    expect(document.querySelector(".publish-typewriter-loader .typewriter .keyboard")).not.toBeNull();
    expect(document.body.textContent).toContain("正在检查 GitHub 连接与仓库权限…");
    expect(document.body.textContent).not.toContain("owner/site · main");
    expect(findButton("取消")?.disabled).toBe(true);
    expect(findButton("发布中…")?.disabled).toBe(true);

    await act(async () =>
      finishPublish?.({
        slug: "0123456789abcdefghjkmnpqrs",
        url: "https://example.com/posts/0123456789abcdefghjkmnpqrs/",
        commitSha: "1234567890abcdef",
        sourceHash: "hash",
        draft: true,
        changed: true,
      }),
    );

    expect(document.body.textContent).toContain("发布成功");
    expect(document.body.textContent).toContain("已发布到麦先生说博客");
    expect(document.body.textContent).not.toContain("保存成功");
    expect(document.body.textContent).not.toContain("草稿已保存");
    expect(document.body.textContent).toContain("GitHub 提交 12345678");
    expect(document.body.textContent).not.toContain("确认发布");
    expect(findButton("复制链接")?.disabled).toBe(false);
    expect(findButton("完成")?.disabled).toBe(false);

    await clickButton("复制链接");

    expect(writeTextMock).toHaveBeenCalledWith("https://example.com/posts/0123456789abcdefghjkmnpqrs/");
    expect(findButton("已复制")?.disabled).toBe(false);
  });

  it("uses update as the only primary action for an already published article", async () => {
    root = await renderDialog(true);

    expect(findButton("更新")?.disabled).toBe(false);
    expect(findButton("发布")).toBeUndefined();
  });

  it("routes repository authorization failures to publishing settings", async () => {
    const openSettings = vi.fn();
    publishBlogMock.mockRejectedValue(new Error("当前 GitHub 仓库不存在或尚未授权，请在设置中管理仓库权限。"));
    root = await renderDialog(false, openSettings);

    await clickButton("发布");

    expect(document.body.textContent).toContain("需要完成 GitHub 设置");
    expect(document.body.textContent).toContain("当前 GitHub 仓库不存在或尚未授权");
    await clickButton("前往设置");
    expect(openSettings).toHaveBeenCalledOnce();
  });

  it("keeps transient GitHub failures retryable", async () => {
    publishBlogMock.mockRejectedValue(new Error("无法检查 GitHub 仓库权限，请检查网络后重试。"));
    root = await renderDialog();

    await clickButton("发布");

    expect(document.body.textContent).toContain("发布失败");
    expect(findButton("重试")?.disabled).toBe(false);
    expect(findButton("前往设置")).toBeUndefined();
  });

  async function renderDialog(initiallyPublished = false, onOpenSettings = vi.fn()): Promise<Root> {
    const container = document.createElement("div");
    document.body.append(container);
    const nextRoot = createRoot(container);
    await act(async () => {
      nextRoot.render(createElement(DialogHarness, { initiallyPublished, onOpenSettings }));
      await Promise.resolve();
      await Promise.resolve();
    });
    return nextRoot;
  }
});

interface PublishResult {
  slug: string;
  url: string;
  commitSha: string;
  sourceHash: string;
  draft: boolean;
  changed: boolean;
}

function DialogHarness({
  initiallyPublished = false,
  onOpenSettings = vi.fn(),
}: {
  initiallyPublished?: boolean;
  onOpenSettings?: () => void;
}) {
  const [currentSheet, setCurrentSheet] = useState<WritingSheet>(() => sheet(initiallyPublished));
  return createElement(BlogPublishDialog, {
    open: true,
    project: project(currentSheet),
    sheet: currentSheet,
    target,
    libraryPath: "/tmp/loby",
    onClose: vi.fn(),
    onOpenSettings,
    onPublished: (targetId: string, publication: PublishingTargetPublication) =>
      setCurrentSheet((current) => ({ ...current, publications: { ...current.publications, [targetId]: publication } })),
  });
}

function project(currentSheet: WritingSheet): WritingProject {
  return {
    id: "project-1",
    title: "博客",
    status: "构思",
    projectGoal: { enabled: false, unit: "words", target: 0 },
    sheets: [currentSheet],
    updatedAt: "2026-07-24",
  };
}

const target = {
  ...createDefaultGitHubBlogTarget(),
  enabled: true,
  blogName: "麦先生说博客",
  menuLabel: "发布到麦先生说",
  repository: "owner/site",
  siteUrl: "https://example.com",
};

function sheet(published = false): WritingSheet {
  return {
    id: "sheet-0123456789abcdefghjkmnpqrs",
    title: "测试文章",
    tags: [],
    targetWords: 0,
    description: "",
    body: "# 测试文章\n\n正文",
    createdAt: "2026-07-24",
    updatedAt: "2026-07-24",
    properties: {},
    ...(published
      ? {
          publications: {
            [target.id]: {
              targetKind: "githubHugoBlog",
              sourceId: "sheet-0123456789abcdefghjkmnpqrs",
              slug: "0123456789abcdefghjkmnpqrs",
              url: "https://example.com/posts/0123456789abcdefghjkmnpqrs/",
              lastCommitSha: "previous12345678",
              lastPublishedAt: "2026-07-23",
              sourceHash: "previous-hash",
              draft: false,
            },
          },
        }
      : {}),
  };
}

async function clickButton(label: string) {
  await act(async () => findButton(label)?.click());
}

function findButton(label: string) {
  return Array.from(document.querySelectorAll("button")).find((button) => button.textContent === label) as HTMLButtonElement | undefined;
}
