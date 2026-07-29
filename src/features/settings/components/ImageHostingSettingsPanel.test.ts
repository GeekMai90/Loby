// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React DOM、Vitest、ImageHostingSettingsPanel 与图床配置 command mock
 * [OUTPUT]: 验证图床服务目录、阿里云二级设置、腾讯云占位、保存后显式加入目录及已保存 Secret 的遮罩回填
 * [POS]: settings 图床目录的结构与凭证交互回归测试，防止具体表单重新占据主页、未完成配置冒充已添加服务或回填值默认暴露
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ImageHostingSettingsPanel } from "@/features/settings/components/ImageHostingSettingsPanel";

const { loadSettingsMock, saveSettingsMock } = vi.hoisted(() => ({
  loadSettingsMock: vi.fn(),
  saveSettingsMock: vi.fn(),
}));

vi.mock("@/features/publishing/model/api", () => ({
  isDesktopPublishingAvailable: () => true,
}));

vi.mock("@/features/publishing/model/wechatImageHost", () => ({
  DEFAULT_WECHAT_IMAGE_HOST_SETTINGS: {
    region: "",
    bucket: "",
    accessKeyId: "",
    customDomain: "",
    objectPrefix: "wechat",
  },
  loadWechatImageHostSettings: loadSettingsMock,
  saveWechatImageHostSettings: saveSettingsMock,
}));

describe("ImageHostingSettingsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    loadSettingsMock.mockResolvedValue(configuredResult);
    saveSettingsMock.mockImplementation(async (settings: object, accessKeySecret: string) => ({
      settings,
      accessKeySecret,
      hasAccessKeySecret: true,
      configured: true,
    }));
  });

  afterEach(() => {
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  it("lists an existing Aliyun service and opens its settings only from the directory row", async () => {
    const { container, root } = await renderPanel();

    expect(container.textContent).toContain("图床服务");
    expect(container.textContent).toContain("阿里云 OSS");
    expect(container.textContent).toContain("添加图床");
    expect(container.textContent).not.toContain("OSS Region");
    const serviceRow = container.querySelector<HTMLElement>("[data-settings-row]");
    expect(serviceRow?.className).toContain("after:left-3");
    expect(serviceRow?.className).toContain("after:right-3");
    expect(serviceRow?.className).not.toContain("border-b");

    await act(async () => {
      [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.includes("阿里云 OSS"))?.click();
    });

    expect(container.textContent).toContain("配置");
    expect(container.textContent).toContain("OSS Region");
    const secretInput = container.querySelector<HTMLInputElement>('input[placeholder="••••••••••••••••"]');
    expect(secretInput?.value).toBe("saved-secret");
    expect(secretInput?.type).toBe("password");
    expect(container.textContent).toContain("点击眼睛可以查看");
    expect(container.querySelector('[aria-label="返回图床服务"]')).not.toBeNull();
    const revealButton = container.querySelector<HTMLButtonElement>('[aria-label="显示 Access Key Secret"]');
    expect(revealButton?.disabled).toBe(false);

    await act(async () => revealButton?.click());
    expect(secretInput?.type).toBe("text");
    expect(secretInput?.value).toBe("saved-secret");
    expect(container.querySelector('[aria-label="隐藏 Access Key Secret"]')).not.toBeNull();

    const saveButton = [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "保存");
    await act(async () => saveButton?.click());
    expect(saveSettingsMock).toHaveBeenCalledWith(
      expect.objectContaining({ bucket: "example-bucket", objectPrefix: "wechat" }),
      "saved-secret",
    );
    expect(container.textContent).toContain("图床设置已保存");

    await act(async () => root.unmount());
  });

  it("keeps a new service out of the directory until its Aliyun configuration is saved", async () => {
    loadSettingsMock.mockResolvedValue({
      settings: configuredSettings,
      accessKeySecret: null,
      hasAccessKeySecret: false,
      configured: false,
    });
    const { container, root } = await renderPanel();

    expect(container.textContent).toContain("尚未添加图床。");
    expect(container.textContent).not.toContain("OSS Region");

    const addButton = [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) =>
      button.textContent?.includes("添加图床"),
    );
    await act(async () => {
      addButton?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0 }));
      await Promise.resolve();
    });

    const menuItems = [...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')];
    const aliyunItem = menuItems.find((item) => item.textContent?.includes("阿里云 OSS"));
    const tencentItem = menuItems.find((item) => item.textContent?.includes("腾讯云 COS"));
    expect(aliyunItem).toBeDefined();
    expect(tencentItem?.textContent).toContain("敬请期待");
    expect(tencentItem?.getAttribute("aria-disabled")).toBe("true");

    await act(async () => {
      aliyunItem?.click();
      await Promise.resolve();
    });
    expect(container.textContent).toContain("OSS Region");

    const secretInput = container.querySelector<HTMLInputElement>('input[placeholder="输入 Access Key Secret"]');
    await act(async () => {
      if (!secretInput) return;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(secretInput, "new-secret");
      secretInput.dispatchEvent(new Event("input", { bubbles: true }));
      await Promise.resolve();
    });

    const revealButton = container.querySelector<HTMLButtonElement>('[aria-label="显示 Access Key Secret"]');
    expect(revealButton?.disabled).toBe(false);
    await act(async () => revealButton?.click());
    expect(secretInput?.type).toBe("text");
    expect(secretInput?.value).toBe("new-secret");
    expect(container.querySelector('[aria-label="隐藏 Access Key Secret"]')).not.toBeNull();

    const saveButton = [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "保存");
    expect(saveButton?.disabled).toBe(false);
    await act(async () => saveButton?.click());
    expect(saveSettingsMock).toHaveBeenCalledWith(configuredSettings, "new-secret");

    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="返回图床服务"]')?.click());
    expect(container.textContent).toContain("阿里云 OSS");
    expect(container.textContent).not.toContain("尚未添加图床。");

    await act(async () => root.unmount());
  });
});

async function renderPanel(): Promise<{ container: HTMLDivElement; root: Root }> {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(createElement(ImageHostingSettingsPanel));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  return { container, root };
}

const configuredSettings = {
  region: "oss-cn-hangzhou",
  bucket: "example-bucket",
  accessKeyId: "LTAI-test",
  customDomain: "https://img.example.com",
  objectPrefix: "wechat",
};

const configuredResult = {
  settings: configuredSettings,
  accessKeySecret: "saved-secret",
  hasAccessKeySecret: true,
  configured: true,
};
