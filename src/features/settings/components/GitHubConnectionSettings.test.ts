// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React DOM、Vitest、GitHubConnectionSettings 与 GitHub Device Flow/opener mock
 * [OUTPUT]: 验证发布目标目录触发 GitHub 浏览器授权后，控制器只返回去敏连接状态而不渲染 token 字段
 * [POS]: settings GitHub 身份控制器的授权回归测试，保护目录布局与敏感凭证之间的边界
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GitHubConnectionSettings } from "@/features/settings/components/GitHubConnectionSettings";

const { completeFlowMock, disconnectMock, getConnectionMock, openUrlMock, startFlowMock } = vi.hoisted(() => ({
  completeFlowMock: vi.fn(),
  disconnectMock: vi.fn(),
  getConnectionMock: vi.fn(),
  openUrlMock: vi.fn(),
  startFlowMock: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: openUrlMock }));
vi.mock("@/features/publishing/model/api", () => ({
  isDesktopPublishingAvailable: () => true,
  getGitHubConnection: getConnectionMock,
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
    expect(container.textContent).toContain("GeekMai90");
    expect(container.querySelector('input[type="password"]')).toBeNull();

    await act(async () => root.unmount());
  });
});
