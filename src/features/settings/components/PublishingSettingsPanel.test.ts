// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React DOM、Vitest、PublishingSettingsPanel 与发布/GitHub command mock
 * [OUTPUT]: 验证发布目标目录、GitHub 显式添加、微信公众号本地配置、Hugo/Starlight 通用适配器、墨问安全掩码及统一内缩分隔
 * [POS]: settings 发布目录的结构与凭证边界回归测试，防止私人实例冒充通用适配器、明文密钥或旧表单说明回流
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PublishingSettingsPanel } from "@/features/settings/components/PublishingSettingsPanel";
import {
  createDefaultGitHubDocsTarget,
  createDefaultPublishingTargetStore,
  createDefaultGitHubBlogTarget,
  replacePublishingTarget,
} from "@/features/publishing/model/publishingTargets";

const {
  deleteSecretMock,
  getConnectionMock,
  hasSecretMock,
  loadImageHostSettingsMock,
  listRepositoriesMock,
  loadWechatDraftSettingsMock,
  refreshConnectionMock,
  saveWechatDraftSettingsMock,
  saveSecretMock,
  validateApiKeyMock,
  validateSavedApiKeyMock,
  validateWechatDraftConnectionMock,
} = vi.hoisted(() => ({
  deleteSecretMock: vi.fn(),
  getConnectionMock: vi.fn(),
  hasSecretMock: vi.fn(),
  loadImageHostSettingsMock: vi.fn(),
  listRepositoriesMock: vi.fn(),
  loadWechatDraftSettingsMock: vi.fn(),
  refreshConnectionMock: vi.fn(),
  saveWechatDraftSettingsMock: vi.fn(),
  saveSecretMock: vi.fn(),
  validateApiKeyMock: vi.fn(),
  validateSavedApiKeyMock: vi.fn(),
  validateWechatDraftConnectionMock: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));
vi.mock("@/shared/lib/appToast", () => ({ showAppToast: vi.fn() }));
vi.mock("@/features/publishing/model/api", () => ({
  isDesktopPublishingAvailable: () => true,
  hasPublishingSecret: hasSecretMock,
  savePublishingSecret: saveSecretMock,
  deletePublishingSecret: deleteSecretMock,
  validateMowenApiKey: validateApiKeyMock,
  validateSavedMowenApiKey: validateSavedApiKeyMock,
  loadWechatDraftSettings: loadWechatDraftSettingsMock,
  saveWechatDraftSettings: saveWechatDraftSettingsMock,
  deleteWechatDraftSettings: vi.fn(),
  validateWechatDraftConnection: validateWechatDraftConnectionMock,
  getGitHubConnection: getConnectionMock,
  listGitHubRepositories: listRepositoriesMock,
  refreshGitHubConnection: refreshConnectionMock,
  startGitHubDeviceFlow: vi.fn(),
  completeGitHubDeviceFlow: vi.fn(),
  disconnectGitHub: vi.fn(),
}));

vi.mock("@/features/publishing/model/wechatImageHost", () => ({
  DEFAULT_WECHAT_IMAGE_HOST_SETTINGS: {
    region: "",
    bucket: "",
    accessKeyId: "",
    customDomain: "",
    objectPrefix: "wechat",
  },
  loadWechatImageHostSettings: loadImageHostSettingsMock,
  saveWechatImageHostSettings: vi.fn(),
}));

describe("PublishingSettingsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    getConnectionMock.mockResolvedValue(disconnectedGitHub);
    listRepositoriesMock.mockResolvedValue([{ fullName: "GeekMai90/maixiansheng-blog", private: true, defaultBranch: "main" }]);
    loadImageHostSettingsMock.mockResolvedValue({
      settings: {
        region: "",
        bucket: "",
        accessKeyId: "",
        customDomain: "",
        objectPrefix: "wechat",
      },
      accessKeySecret: null,
      hasAccessKeySecret: false,
      configured: false,
    });
    loadWechatDraftSettingsMock.mockResolvedValue({ appId: "", hasAppSecret: false, configured: false });
    saveWechatDraftSettingsMock.mockImplementation(async ({ appId }: { appId: string }) => ({
      appId,
      hasAppSecret: true,
      configured: true,
    }));
  });

  afterEach(() => {
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  it("lists only the saved Mowen target without returning its secret value", async () => {
    hasSecretMock.mockResolvedValue(true);
    const { container, root } = await renderPanel();

    expect(hasSecretMock).toHaveBeenCalledWith("mowen", "default");
    expect(container.textContent).toContain("发布目标");
    expect(container.textContent).toContain("墨问笔记");
    expect(container.textContent).toContain("添加发布目标");
    expect(container.textContent).toContain("图床服务");
    expect(container.textContent).toContain("添加图床");
    expect(container.textContent).not.toContain("GitHub 发布目标");
    expect(container.querySelector('input[type="password"]')).toBeNull();
    expect(container.querySelector('[aria-label="墨问笔记发布目标操作"]')).not.toBeNull();

    await act(async () => root.unmount());
  });

  it("edits a saved Mowen key through a masked placeholder and reveals only the new draft", async () => {
    hasSecretMock.mockResolvedValue(true);
    const { container, root } = await renderPanel();

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('[aria-label="墨问笔记发布目标操作"]')
        ?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0 }));
      await Promise.resolve();
    });
    const settingsItem = [...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((item) =>
      item.textContent?.includes("设置 API Key"),
    );
    expect(settingsItem).toBeDefined();

    await act(async () => {
      settingsItem?.click();
      await Promise.resolve();
    });

    expect(document.body.textContent).toContain("设置墨问 API Key");
    expect(document.body.textContent).not.toContain("不会回填明文");
    const input = document.body.querySelector<HTMLInputElement>('input[placeholder="••••••••••••"]');
    const revealButton = document.body.querySelector<HTMLButtonElement>('[aria-label="显示 API Key"]');
    expect(input?.value).toBe("");
    expect(input?.type).toBe("password");
    expect(revealButton?.disabled).toBe(true);

    await act(async () => {
      if (!input) return;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, "new-mowen-key");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await Promise.resolve();
    });

    expect(revealButton?.disabled).toBe(false);
    await act(async () => revealButton?.click());
    expect(input?.type).toBe("text");
    expect(input?.value).toBe("new-mowen-key");
    expect(document.body.querySelector('[aria-label="隐藏 API Key"]')).not.toBeNull();
    expect(document.body.textContent).toContain("验证并保存");

    await act(async () => root.unmount());
  });

  it("adds WeChat as a publishing target without validating the network on save", async () => {
    hasSecretMock.mockResolvedValue(false);
    const { container, root } = await renderPanel();
    const addButton = [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) =>
      button.textContent?.includes("添加发布目标"),
    );
    await act(async () => {
      addButton?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0 }));
      await Promise.resolve();
    });
    const wechatItem = [...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((item) =>
      item.textContent?.includes("微信公众号"),
    );
    await act(async () => {
      wechatItem?.click();
      await Promise.resolve();
    });
    const inputs = document.body.querySelectorAll<HTMLInputElement>("[role='dialog'] input");
    expect(inputs).toHaveLength(2);
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(inputs[0], "wx-test-app-id");
      inputs[0]?.dispatchEvent(new Event("input", { bubbles: true }));
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(inputs[1], "wechat-secret");
      inputs[1]?.dispatchEvent(new Event("input", { bubbles: true }));
      await Promise.resolve();
    });
    const saveButton = [...document.body.querySelectorAll<HTMLButtonElement>("[role='dialog'] button")].find((button) =>
      button.textContent?.includes("保存"),
    );
    await act(async () => {
      saveButton?.click();
      await Promise.resolve();
    });
    expect(saveWechatDraftSettingsMock).toHaveBeenCalledWith({ appId: "wx-test-app-id", appSecret: "wechat-secret" });
    expect(validateWechatDraftConnectionMock).not.toHaveBeenCalled();
    expect(container.querySelector('[aria-label="微信公众号发布目标操作"]')).not.toBeNull();

    await act(async () => root.unmount());
  });

  it("shows GitHub child targets only after GitHub has been added", async () => {
    hasSecretMock.mockResolvedValue(false);
    getConnectionMock.mockResolvedValue(connectedGitHub);
    const configuredStore = replacePublishingTarget(createDefaultPublishingTargetStore(), {
      ...createDefaultGitHubBlogTarget(),
      blogName: "麦先生说博客",
      menuLabel: "麦先生说博客",
      repository: "GeekMai90/maixiansheng-blog",
      siteUrl: "https://blog.geekmailab.com",
    });
    const { container, root } = await renderPanel({ ...panelProps, publishingTargets: configuredStore });

    expect(container.textContent).toContain("GitHub 发布目标");
    expect(container.textContent).toContain("添加 GitHub 发布目标");
    expect(container.textContent).toContain("麦先生说博客");
    expect(container.querySelector('[aria-label="GitHub 发布目标操作"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="麦先生说博客发布目标操作"]')).not.toBeNull();
    const rows = container.querySelectorAll<HTMLElement>("[data-settings-row]");
    expect(rows).toHaveLength(2);
    rows.forEach((row) => {
      expect(row.className).toContain("after:left-3");
      expect(row.className).toContain("after:right-3");
      expect(row.className).not.toContain("border-b");
    });

    await act(async () => root.unmount());
  });

  it("keeps GitHub targets empty until the user chooses a generic adapter", async () => {
    hasSecretMock.mockResolvedValue(false);
    getConnectionMock.mockResolvedValue(connectedGitHub);
    const { container, root } = await renderPanel();

    expect(container.textContent).toContain("尚未添加 GitHub 发布目标。");
    expect(container.textContent).toContain("添加 GitHub 发布目标");
    expect(container.querySelector('[aria-label="GitHub 博客发布目标操作"]')).toBeNull();

    const addButton = [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) =>
      button.textContent?.includes("添加 GitHub 发布目标"),
    );
    await act(async () => {
      addButton?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0 }));
      await Promise.resolve();
    });
    const menuItems = [...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')];
    const templateItem = menuItems.find((item) => item.textContent?.includes("Hugo 博客"));
    const docsTemplateItem = menuItems.find((item) => item.textContent?.includes("Starlight 文档站"));
    expect(templateItem).toBeDefined();
    expect(docsTemplateItem).toBeDefined();
    expect(templateItem?.querySelector("svg")).toBeNull();
    expect(docsTemplateItem?.querySelector("svg")).toBeNull();
    expect(menuItems.some((item) => item.textContent?.includes("麦先生说"))).toBe(false);

    await act(async () => {
      templateItem?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(document.body.querySelector("[role='dialog'] h2")?.textContent).toBe("GitHub 博客");
    expect(document.body.textContent).toContain("内容适配：Hugo 博客");
    expect(document.body.textContent).not.toContain("设置一个应用级发布目标");
    expect(document.body.textContent).not.toContain("在所有文稿的分享菜单中显示这个入口");
    expect(document.body.textContent).not.toContain("用于设置页和发布窗口识别这个目标");
    expect(document.body.textContent).not.toContain("该名称会显示在文稿右上角的分享菜单中");
    const labels = [...document.body.querySelectorAll<HTMLLabelElement>("[role='dialog'] label")];
    expect(labels).toHaveLength(6);
    labels.forEach((label) => {
      expect(label.className).toContain("text-body");
      expect(label.className).toContain("font-medium");
      expect(label.className).toContain("text-foreground");
    });
    document.body
      .querySelectorAll<HTMLInputElement>("[role='dialog'] input[data-slot='input']")
      .forEach((input) => expect(input.className).toContain("text-foreground"));

    await act(async () => root.unmount());
  });

  it("shows Starlight paths directly without a disclosure section", async () => {
    hasSecretMock.mockResolvedValue(false);
    getConnectionMock.mockResolvedValue(connectedGitHub);
    const { container, root } = await renderPanel();

    const addButton = [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) =>
      button.textContent?.includes("添加 GitHub 发布目标"),
    );
    await act(async () => {
      addButton?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0 }));
      await Promise.resolve();
    });
    const starlightItem = [...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((item) =>
      item.textContent?.includes("Starlight 文档站"),
    );
    await act(async () => {
      starlightItem?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const dialog = document.body.querySelector<HTMLElement>("[role='dialog']");
    expect(dialog?.textContent).toContain("图片目录");
    expect(dialog?.textContent).toContain("文档清单");
    expect(dialog?.textContent).not.toContain("Starlight 适配路径");
    expect(dialog?.querySelector("details")).toBeNull();
    const defaults = createDefaultGitHubDocsTarget();
    expect(dialog?.querySelector<HTMLInputElement>(`input[value="${defaults.assetsRoot}"]`)).not.toBeNull();
    expect(dialog?.querySelector<HTMLInputElement>(`input[value="${defaults.manifestPath}"]`)).not.toBeNull();

    await act(async () => root.unmount());
  });

  it("shows a read failure instead of presenting it as an empty directory", async () => {
    hasSecretMock.mockRejectedValue(new Error("配置文件无法读取"));
    const { container, root } = await renderPanel();

    expect(container.textContent).toContain("无法读取墨问发布目标：配置文件无法读取");

    await act(async () => root.unmount());
  });

  it("keeps image hosting inside Publishing and lets its detail view take over the content area", async () => {
    hasSecretMock.mockResolvedValue(false);
    loadImageHostSettingsMock.mockResolvedValue({
      settings: {
        region: "oss-cn-hangzhou",
        bucket: "example-bucket",
        accessKeyId: "LTAI-test",
        customDomain: "https://img.example.com",
        objectPrefix: "wechat",
      },
      accessKeySecret: "saved-secret",
      hasAccessKeySecret: true,
      configured: true,
    });
    const { container, root } = await renderPanel();

    expect(container.textContent).toContain("发布目标");
    expect(container.textContent).toContain("图床服务");
    await act(async () => {
      [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.includes("阿里云 OSS"))?.click();
    });

    expect(container.querySelector<HTMLElement>("[data-publishing-directory]")?.className).toContain("hidden");
    expect(container.textContent).toContain("OSS Region");
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="返回图床服务"]')?.click());
    expect(container.querySelector<HTMLElement>("[data-publishing-directory]")?.className).toContain("contents");
    expect(container.textContent).toContain("图床服务");

    await act(async () => root.unmount());
  });
});

async function renderPanel(props = panelProps) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(createElement(PublishingSettingsPanel, props));
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
