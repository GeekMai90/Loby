// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PublishingSettingsPanel } from "@/features/settings/components/PublishingSettingsPanel";
import { createDefaultPublishingTargetStore } from "@/features/publishing/model/publishingTargets";

const { hasSecretMock, saveSecretMock, validateApiKeyMock } = vi.hoisted(() => ({
  hasSecretMock: vi.fn(),
  saveSecretMock: vi.fn(),
  validateApiKeyMock: vi.fn(),
}));

vi.mock("@/features/publishing/model/api", () => ({
  isDesktopPublishingAvailable: () => true,
  hasPublishingSecret: hasSecretMock,
  savePublishingSecret: saveSecretMock,
  validateMowenApiKey: validateApiKeyMock,
  getGitHubConnection: vi.fn().mockResolvedValue({
    connected: false,
    login: "",
    avatarUrl: "",
    installationCount: 0,
    repositoryCount: 0,
    installationUrl: "https://github.com/apps/loby-writing/installations/new",
    manageUrl: "",
  }),
}));

describe("PublishingSettingsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  it("restores the saved Mowen API Key state without returning the secret value", async () => {
    hasSecretMock.mockResolvedValue(true);
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(createElement(PublishingSettingsPanel, panelProps));
      await Promise.resolve();
    });

    const input = container.querySelector<HTMLInputElement>('input[type="password"]');
    expect(hasSecretMock).toHaveBeenCalledWith("mowen", "default");
    expect(input?.value).toBe("");
    expect(input?.placeholder).toBe("••••••••••••••••");
    expect(container.textContent).toContain("重启后不会回填明文");
    expect(container.textContent).toContain("连接 GitHub");
    expect(container.textContent).toContain("GitHub 发布目标");
    expect(container.textContent).toContain("GitHub 博客");
    expect(container.textContent).not.toContain("Fine-grained token");
    expect(container.querySelector('[aria-label="API Key 已验证并保存"]')).not.toBeNull();

    await act(async () => root.unmount());
  });

  it("shows a read failure instead of presenting it as a missing API Key", async () => {
    hasSecretMock.mockRejectedValue(new Error("配置文件无法读取"));
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(createElement(PublishingSettingsPanel, panelProps));
      await Promise.resolve();
    });

    expect(container.textContent).toContain("无法读取已保存的 API Key：配置文件无法读取");
    expect(container.querySelector('[aria-label="API Key 读取失败"]')).not.toBeNull();

    await act(async () => root.unmount());
  });
});

const panelProps = {
  publishingTargets: createDefaultPublishingTargetStore(),
  publishingTargetsReady: true,
  publishingTargetsError: "",
  onSavePublishingTarget: vi.fn().mockResolvedValue(undefined),
};
