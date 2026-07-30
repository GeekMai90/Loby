// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React DOM、Vitest、公众号草稿 API/主题渲染 mock 与 WechatDraftPublishDialog
 * [OUTPUT]: 验证公众号配置错误进入设置、IP 白名单错误保持原地重试且不绕过确认态
 * [POS]: publishing 的公众号草稿控制器回归测试，保护错误分流和用户确认边界
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WechatDraftPublishDialog } from "@/features/publishing/components/WechatDraftPublishDialog";
import { getWechatTheme } from "@/features/publishing/model/wechatThemes";
import type { WritingProject, WritingSheet } from "@/shared/types";

const { loadSettingsMock, publishDraftMock, renderArticleMock } = vi.hoisted(() => ({
  loadSettingsMock: vi.fn(),
  publishDraftMock: vi.fn(),
  renderArticleMock: vi.fn(),
}));

vi.mock("@/features/publishing/model/api", () => ({
  isDesktopPublishingAvailable: () => true,
  loadWechatDraftSettings: loadSettingsMock,
  publishWechatDraft: publishDraftMock,
}));

vi.mock("@/features/publishing/model/wechatRenderer", () => ({
  renderWechatArticle: renderArticleMock,
}));

describe("WechatDraftPublishDialog", () => {
  let root: Root | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    loadSettingsMock.mockResolvedValue({ appId: "wx-test-app-id", hasAppSecret: true, configured: true });
    renderArticleMock.mockResolvedValue({ title: "测试文章", html: "<section>正文</section>" });
  });

  afterEach(async () => {
    if (root) await act(async () => root?.unmount());
    root = null;
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  it("routes missing credentials to publishing settings", async () => {
    loadSettingsMock.mockResolvedValue({ appId: "", hasAppSecret: false, configured: false });
    const onClose = vi.fn();
    const onOpenSettings = vi.fn();
    root = await renderDialog({ onClose, onOpenSettings });

    await clickButton("推送到草稿箱");

    expect(publishDraftMock).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("需要完成公众号设置");
    expect(document.body.textContent).toContain("设置 → 发布 → 发布目标");
    await clickButton("前往设置");
    expect(onClose).toHaveBeenCalledOnce();
    expect(onOpenSettings).toHaveBeenCalledOnce();
  });

  it("keeps an IP whitelist failure retryable in place", async () => {
    publishDraftMock.mockRejectedValue(
      new Error("当前公网 IP 123.173.58.44 不在公众号白名单中。请前往“微信开发者平台 → 域名与消息推送配置 → IP 白名单”添加后重试。"),
    );
    root = await renderDialog();

    await clickButton("推送到草稿箱");

    expect(document.body.textContent).toContain("草稿推送失败");
    expect(document.body.textContent).toContain("123.173.58.44");
    expect(document.body.textContent).toContain("微信开发者平台 → 域名与消息推送配置 → IP 白名单");
    expect(findButton("重试")?.disabled).toBe(false);
    expect(findButton("前往设置")).toBeUndefined();
  });

  async function renderDialog(overrides: { onClose?: () => void; onOpenSettings?: () => void } = {}): Promise<Root> {
    const container = document.createElement("div");
    document.body.append(container);
    const nextRoot = createRoot(container);
    await act(async () => {
      nextRoot.render(
        createElement(WechatDraftPublishDialog, {
          open: true,
          project,
          sheet,
          libraryPath: "/tmp/loby-library",
          theme: getWechatTheme("loby-basic"),
          onClose: overrides.onClose ?? vi.fn(),
          onOpenSettings: overrides.onOpenSettings ?? vi.fn(),
          onPublished: vi.fn(),
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

const sheet: WritingSheet = {
  id: "sheet-1",
  title: "测试文章",
  tags: [],
  targetWords: 0,
  description: "",
  body: "# 测试文章\n\n![封面](cover.png)\n\n正文",
  createdAt: "2026-07-30",
  updatedAt: "2026-07-30",
  properties: {},
};

const project: WritingProject = {
  id: "project-1",
  title: "测试项目",
  status: "待发布",
  projectGoal: { enabled: false, unit: "words", target: 0 },
  groups: [],
  sheets: [sheet],
  updatedAt: "2026-07-30",
};
