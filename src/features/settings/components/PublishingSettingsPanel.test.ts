// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React DOM、Vitest、PublishingSettingsPanel 与发布/GitHub command mock
 * [OUTPUT]: 验证发布目标目录、按接入状态显示的 GitHub 子目标、墨问空状态与统一内缩列表分隔
 * [POS]: settings 发布目录的结构与凭证边界回归测试，防止渠道接入和渠道内部配置再次混排
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PublishingSettingsPanel } from "@/features/settings/components/PublishingSettingsPanel";
import { createDefaultPublishingTargetStore } from "@/features/publishing/model/publishingTargets";

const { deleteSecretMock, getConnectionMock, hasSecretMock, saveSecretMock, validateApiKeyMock, validateSavedApiKeyMock } = vi.hoisted(
  () => ({
    deleteSecretMock: vi.fn(),
    getConnectionMock: vi.fn(),
    hasSecretMock: vi.fn(),
    saveSecretMock: vi.fn(),
    validateApiKeyMock: vi.fn(),
    validateSavedApiKeyMock: vi.fn(),
  }),
);

vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));
vi.mock("@/shared/lib/appToast", () => ({ showAppToast: vi.fn() }));
vi.mock("@/features/publishing/model/api", () => ({
  isDesktopPublishingAvailable: () => true,
  hasPublishingSecret: hasSecretMock,
  savePublishingSecret: saveSecretMock,
  deletePublishingSecret: deleteSecretMock,
  validateMowenApiKey: validateApiKeyMock,
  validateSavedMowenApiKey: validateSavedApiKeyMock,
  getGitHubConnection: getConnectionMock,
  startGitHubDeviceFlow: vi.fn(),
  completeGitHubDeviceFlow: vi.fn(),
  disconnectGitHub: vi.fn(),
}));

describe("PublishingSettingsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getConnectionMock.mockResolvedValue(disconnectedGitHub);
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  it("lists only the saved Mowen target without returning its secret value", async () => {
    hasSecretMock.mockResolvedValue(true);
    const { container, root } = await renderPanel();

    expect(hasSecretMock).toHaveBeenCalledWith("mowen", "default");
    expect(container.textContent).toContain("发布目标");
    expect(container.textContent).toContain("墨问笔记");
    expect(container.textContent).toContain("添加发布目标");
    expect(container.textContent).not.toContain("GitHub 发布目标");
    expect(container.querySelector('input[type="password"]')).toBeNull();
    expect(container.querySelector('[aria-label="墨问笔记发布目标操作"]')).not.toBeNull();

    await act(async () => root.unmount());
  });

  it("shows GitHub child targets only after GitHub has been added", async () => {
    hasSecretMock.mockResolvedValue(false);
    getConnectionMock.mockResolvedValue(connectedGitHub);
    const { container, root } = await renderPanel();

    expect(container.textContent).toContain("GitHub 发布目标");
    expect(container.textContent).toContain("GitHub 博客");
    expect(container.querySelector('[aria-label="GitHub 发布目标操作"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="GitHub 博客发布目标操作"]')).not.toBeNull();
    const rows = container.querySelectorAll<HTMLElement>("[data-settings-row]");
    expect(rows).toHaveLength(2);
    rows.forEach((row) => {
      expect(row.className).toContain("after:left-3");
      expect(row.className).toContain("after:right-3");
      expect(row.className).not.toContain("border-b");
    });

    await act(async () => root.unmount());
  });

  it("shows a read failure instead of presenting it as an empty directory", async () => {
    hasSecretMock.mockRejectedValue(new Error("配置文件无法读取"));
    const { container, root } = await renderPanel();

    expect(container.textContent).toContain("无法读取墨问发布目标：配置文件无法读取");

    await act(async () => root.unmount());
  });
});

async function renderPanel() {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(createElement(PublishingSettingsPanel, panelProps));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  return { container, root };
}

const disconnectedGitHub = {
  connected: false,
  login: "",
  avatarUrl: "",
  installationCount: 0,
  repositoryCount: 0,
  installationUrl: "https://github.com/apps/loby-writing/installations/new",
  manageUrl: "",
};

const connectedGitHub = {
  connected: true,
  login: "GeekMai90",
  avatarUrl: "",
  installationCount: 1,
  repositoryCount: 3,
  installationUrl: "https://github.com/apps/loby-writing/installations/new",
  manageUrl: "https://github.com/settings/installations/1",
};

const panelProps = {
  publishingTargets: createDefaultPublishingTargetStore(),
  publishingTargetsReady: true,
  publishingTargetsError: "",
  onSavePublishingTarget: vi.fn().mockResolvedValue(undefined),
};
