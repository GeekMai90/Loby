// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React DOM、Vitest、GitHub 发布 API mock 与 BlogPublishDialog
 * [OUTPUT]: 验证 GitHub 打字机进度、发布成功态及文稿元数据回写后的状态稳定性
 * [POS]: publishing 的项目 GitHub 发布集成测试，保护发布结果不被父级 sheet 更新重置
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BlogPublishDialog } from "@/features/publishing/components/BlogPublishDialog";
import type { BlogPublication, WritingProject, WritingSheet } from "@/shared/types";

const { listRepositoriesMock, publishBlogMock, writeTextMock } = vi.hoisted(() => ({
  listRepositoriesMock: vi.fn(),
  publishBlogMock: vi.fn(),
  writeTextMock: vi.fn(),
}));

vi.mock("@/features/publishing/model/api", () => ({
  isDesktopPublishingAvailable: () => true,
  listGitHubRepositories: listRepositoriesMock,
  publishBlogPost: publishBlogMock,
}));

describe("BlogPublishDialog", () => {
  let root: Root | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    listRepositoriesMock.mockResolvedValue([{ fullName: "owner/site", private: false, defaultBranch: "main" }]);
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
          onProgress?.({ stage: "preparing" });
        }),
    );
    root = await renderDialog();

    expect(document.querySelector("[role='dialog'] h2")?.textContent).toBe("发布到麦先生说博客");
    expect(document.body.textContent).not.toContain("GitHub 发布当前文稿");
    expect(document.body.textContent).not.toContain("文章地址 ID");
    expect(document.body.textContent).not.toContain("example.com/posts/");
    expect(document.querySelector("[role='tablist'][aria-label='GitHub 发布可见范围']")).not.toBeNull();
    expect(document.body.textContent).toContain("所有人可查看");
    expect(document.body.textContent).toContain("owner/site · main");

    await clickButton("私密");

    expect(document.body.textContent).toContain("仅自己可见");
    expect(findButton("发布")?.disabled).toBe(false);
    expect(document.body.textContent).not.toContain("保存草稿");

    await clickButton("发布");

    expect(document.querySelector(".publish-typewriter-loader .typewriter .keyboard")).not.toBeNull();
    expect(document.body.textContent).toContain("正在检查文稿…");
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

  async function renderDialog(initiallyPublished = false): Promise<Root> {
    const container = document.createElement("div");
    document.body.append(container);
    const nextRoot = createRoot(container);
    await act(async () => {
      nextRoot.render(createElement(DialogHarness, { initiallyPublished }));
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

function DialogHarness({ initiallyPublished = false }: { initiallyPublished?: boolean }) {
  const [currentSheet, setCurrentSheet] = useState<WritingSheet>(() => sheet(initiallyPublished));
  return createElement(BlogPublishDialog, {
    open: true,
    project: project(currentSheet),
    sheet: currentSheet,
    libraryPath: "/tmp/loby",
    onClose: vi.fn(),
    onOpenSettings: vi.fn(),
    onPublished: (publication: BlogPublication) => setCurrentSheet((current) => ({ ...current, blogPublication: publication })),
  });
}

function project(currentSheet: WritingSheet): WritingProject {
  return {
    id: "project-1",
    title: "博客",
    description: "",
    status: "构思",
    targetPlatform: "",
    targetWords: 0,
    tags: [],
    sheets: [currentSheet],
    updatedAt: "2026-07-24",
    blogPublishing: {
      enabled: true,
      name: "麦先生说博客",
      repository: "owner/site",
      branch: "main",
      contentRoot: "content/posts",
      siteUrl: "https://example.com",
    },
  };
}

function sheet(published = false): WritingSheet {
  return {
    id: "sheet-0123456789abcdefghjkmnpqrs",
    title: "测试文章",
    status: "构思",
    targetWords: 0,
    summary: "",
    body: "# 测试文章\n\n正文",
    createdAt: "2026-07-24",
    updatedAt: "2026-07-24",
    ...(published
      ? {
          blogPublication: {
            sourceId: "sheet-0123456789abcdefghjkmnpqrs",
            slug: "0123456789abcdefghjkmnpqrs",
            url: "https://example.com/posts/0123456789abcdefghjkmnpqrs/",
            lastCommitSha: "previous12345678",
            lastPublishedAt: "2026-07-23",
            sourceHash: "previous-hash",
            draft: false,
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
