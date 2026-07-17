// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ImageHostingSettingsPanel } from "./ImageHostingSettingsPanel";

const { loadSettingsMock, saveSettingsMock } = vi.hoisted(() => ({
  loadSettingsMock: vi.fn(),
  saveSettingsMock: vi.fn(),
}));

vi.mock("../../lib/publishing/api", () => ({
  isDesktopPublishingAvailable: () => true,
}));

vi.mock("../../lib/publishing/wechatImageHost", () => ({
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
    loadSettingsMock.mockResolvedValue({
      settings: {
        region: "oss-cn-hangzhou",
        bucket: "example-bucket",
        accessKeyId: "LTAI-test",
        customDomain: "https://img.example.com",
        objectPrefix: "wechat",
      },
      hasAccessKeySecret: true,
      configured: true,
    });
    saveSettingsMock.mockImplementation(async (settings: object) => ({
      settings,
      hasAccessKeySecret: true,
      configured: true,
    }));
  });

  it("loads and saves aliyun oss settings without revealing the saved secret", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(ImageHostingSettingsPanel));
      await Promise.resolve();
    });

    expect(container.textContent).toContain("微信公众号图床");
    expect(container.textContent).toContain("阿里云 OSS");
    expect(container.textContent).toContain("重启后不会回填明文");
    expect(container.querySelector<HTMLInputElement>('input[placeholder="••••••••••••••••"]')?.value).toBe("");

    const saveButton = [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "保存");
    await act(async () => saveButton?.click());
    expect(saveSettingsMock).toHaveBeenCalledWith(expect.objectContaining({ bucket: "example-bucket", objectPrefix: "wechat" }), "");
    expect(container.textContent).toContain("图床设置已保存");

    await act(async () => root.unmount());
    container.remove();
  });
});
