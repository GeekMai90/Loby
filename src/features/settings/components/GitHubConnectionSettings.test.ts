// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GitHubConnectionSettings } from "@/features/settings/components/GitHubConnectionSettings";

const { completeFlowMock, getConnectionMock, openUrlMock, startFlowMock } = vi.hoisted(() => ({
  completeFlowMock: vi.fn(),
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
  disconnectGitHub: vi.fn(),
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
      root.render(createElement(GitHubConnectionSettings));
      await Promise.resolve();
    });
    const connectButton = [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) =>
      button.textContent?.includes("连接 GitHub"),
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
    expect(container.textContent).toContain("3 个可写仓库");
    expect(container.querySelector('input[type="password"]')).toBeNull();

    await act(async () => root.unmount());
  });
});
