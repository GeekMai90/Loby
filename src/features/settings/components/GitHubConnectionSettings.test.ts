// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React DOM、Vitest、GitHubConnectionSettings 与 GitHub 本地状态/显式刷新/Device Flow/opener mock
 * [OUTPUT]: 验证进入设置不远程刷新、刷新失败保留已添加状态，以及浏览器授权只返回去敏连接状态
 * [POS]: settings GitHub 身份控制器的缓存与授权回归测试，保护即时目录、网络失败和敏感凭证之间的边界
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GitHubConnectionSettings } from "@/features/settings/components/GitHubConnectionSettings";

const { completeFlowMock, disconnectMock, getConnectionMock, openUrlMock, refreshConnectionMock, startFlowMock } = vi.hoisted(() => ({
  completeFlowMock: vi.fn(),
  disconnectMock: vi.fn(),
  getConnectionMock: vi.fn(),
  openUrlMock: vi.fn(),
  refreshConnectionMock: vi.fn(),
  startFlowMock: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: openUrlMock }));
vi.mock("@/shared/lib/appToast", () => ({ showAppToast: vi.fn() }));
vi.mock("@/features/publishing/model/api", () => ({
  isDesktopPublishingAvailable: () => true,
  getGitHubConnection: getConnectionMock,
  refreshGitHubConnection: refreshConnectionMock,
  startGitHubDeviceFlow: startFlowMock,
  completeGitHubDeviceFlow: completeFlowMock,
  disconnectGitHub: disconnectMock,
}));

describe("GitHubConnectionSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    openUrlMock.mockResolvedValue(undefined);
    getConnectionMock.mockResolvedValue({
      connected: false,
      login: "",
      avatarUrl: "",
      installationCount: 0,
      repositoryCount: 0,
      installationUrl: "https://github.com/apps/loby-writing/installations/new",
      manageUrl: "",
    });
    refreshConnectionMock.mockResolvedValue({
      connected: false,
      login: "",
      avatarUrl: "",
      installationCount: 0,
      repositoryCount: 0,
      installationUrl: "https://github.com/apps/loby-writing/installations/new",
      manageUrl: "",
    });
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  it("connects through the browser device flow without rendering a token field", async () => {
    startFlowMock.mockResolvedValue({
      flowId: "local-flow",
      userCode: "ABCD-EFGH",
      verificationUri: "https://github.com/login/device",
      expiresIn: 900,
    });
    completeFlowMock.mockResolvedValue({
      connected: true,
      login: "GeekMai90",
      avatarUrl: "",
      installationCount: 1,
      repositoryCount: 3,
      installationUrl: "https://github.com/apps/loby-writing/installations/new",
      manageUrl: "https://github.com/settings/installations/1",
    });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        createElement(GitHubConnectionSettings, {
          children: (controller) =>
            createElement("button", { type: "button", onClick: controller.connect }, controller.connection?.login || "添加 GitHub"),
        }),
      );
      await Promise.resolve();
    });
    const connectButton = [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) =>
      button.textContent?.includes("添加 GitHub"),
    );
    await act(async () => {
      connectButton?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(startFlowMock).toHaveBeenCalledOnce();
    expect(completeFlowMock).toHaveBeenCalledWith(expect.objectContaining({ flowId: "local-flow" }));
    expect(openUrlMock).toHaveBeenCalledWith("https://github.com/login/device");
    expect(container.textContent).toContain("GeekMai90");
    expect(container.querySelector('input[type="password"]')).toBeNull();

    await act(async () => root.unmount());
  });

  it("does not validate remotely on entry and keeps the cached row when manual refresh fails", async () => {
    getConnectionMock.mockResolvedValue({
      connected: true,
      login: "GeekMai90",
      avatarUrl: "",
      installationCount: 0,
      repositoryCount: 0,
      installationUrl: "https://github.com/apps/loby-writing/installations/new",
      manageUrl: "https://github.com/settings/installations",
    });
    refreshConnectionMock.mockRejectedValue(new Error("网络暂时不可用"));
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        createElement(GitHubConnectionSettings, {
          children: (controller) =>
            createElement(
              "div",
              null,
              createElement("span", null, controller.connection?.login || (controller.added ? "GitHub 已添加" : "GitHub 未添加")),
              createElement("button", { type: "button", onClick: controller.refresh }, "立即刷新"),
            ),
        }),
      );
      await Promise.resolve();
    });

    expect(getConnectionMock).toHaveBeenCalledOnce();
    expect(refreshConnectionMock).not.toHaveBeenCalled();
    expect(container.textContent).toContain("GeekMai90");

    await act(async () => {
      container.querySelector<HTMLButtonElement>("button")?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(refreshConnectionMock).toHaveBeenCalledOnce();
    expect(container.textContent).toContain("GeekMai90");

    await act(async () => root.unmount());
  });
});
