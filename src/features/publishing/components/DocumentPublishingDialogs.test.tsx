// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React DOM、Vitest、当前发布上下文与 DocumentPublishingDialogs
 * [OUTPUT]: 验证文稿发布 overlay 能按状态分流到公众号、直接发布与 GitHub 博客 surface
 * [POS]: publishing overlay 的聚焦回归测试，保护 App 拆分后当前文稿和发布目标上下文不丢失
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WritingProject, WritingSheet } from "@/shared/types";
import { createDefaultGitHubBlogTarget } from "@/features/publishing/model/publishingTargets";
import { DocumentPublishingDialogs, type DocumentPublishingDialogsProps } from "@/features/publishing/components/DocumentPublishingDialogs";

vi.mock("@/features/publishing/components/WechatPublishDialog", () => ({
  WechatPublishDialog: ({ sheet }: { sheet: WritingSheet }) => createElement("div", { "data-testid": "wechat-dialog" }, sheet.title),
}));

vi.mock("@/features/publishing/components/DirectPublishDialog", () => ({
  DirectPublishDialog: ({ channel }: { channel: string }) => createElement("div", { "data-testid": "direct-dialog" }, channel),
}));

vi.mock("@/features/publishing/components/BlogPublishDialog", () => ({
  BlogPublishDialog: ({ project, target }: { project: WritingProject; target: { id: string } }) =>
    createElement("div", { "data-testid": "blog-dialog" }, `${project.title}:${target.id}`),
}));

const activeSheet: WritingSheet = {
  id: "sheet-active",
  title: "当前文稿",
  tags: [],
  targetWords: 0,
  description: "",
  body: "正文",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  properties: {},
};

const publishingSheet: WritingSheet = { ...activeSheet, title: "最新正文" };
const project: WritingProject = {
  id: "project-publishing-overlay",
  title: "发布项目",
  status: "修改中",
  updatedAt: "2026-01-01T00:00:00.000Z",
  sheets: [activeSheet],
};

const blogTarget = { ...createDefaultGitHubBlogTarget(), repository: "owner/blog", siteUrl: "https://blog.example.com" };

function createProps(overrides: Partial<DocumentPublishingDialogsProps> = {}): DocumentPublishingDialogsProps {
  return {
    project,
    activeSheet,
    publishingSheet,
    libraryPath: "/writing-library",
    wechatPublishOpen: false,
    directPublishChannel: null,
    blogTarget: undefined,
    onCloseWechat: vi.fn(),
    onCloseDirect: vi.fn(),
    onCloseBlog: vi.fn(),
    onOpenImageHostingSettings: vi.fn(),
    onOpenSettings: vi.fn(),
    onUpdateSheet: vi.fn(),
    onPublished: vi.fn(),
    ...overrides,
  };
}

describe("DocumentPublishingDialogs", () => {
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

  async function renderDialogs(props: DocumentPublishingDialogsProps) {
    await act(async () => {
      root.render(createElement(DocumentPublishingDialogs, props));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  it("passes the latest publishing sheet to the WeChat surface", async () => {
    await renderDialogs(createProps({ wechatPublishOpen: true }));
    expect(document.body.querySelector('[data-testid="wechat-dialog"]')?.textContent).toBe("最新正文");
  });

  it("keeps direct publishing and blog target surfaces independently addressable", async () => {
    await renderDialogs(createProps({ directPublishChannel: "mowen", blogTarget }));
    expect(document.body.querySelector('[data-testid="direct-dialog"]')?.textContent).toBe("mowen");
    expect(document.body.querySelector('[data-testid="blog-dialog"]')?.textContent).toBe(`发布项目:${blogTarget.id}`);
  });
});
