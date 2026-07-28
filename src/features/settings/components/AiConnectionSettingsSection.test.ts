// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React DOM、Vitest、AiConnectionSettingsSection 与 Agent runtime mock
 * [OUTPUT]: 验证 ChatGPT 授权、彩色品牌 SVG 及真实能力可见，已添加订阅不能重复新增，且单个 Provider 读取失败不清空其他连接
 * [POS]: settings 连接目录的故障隔离回归测试，覆盖并发状态读取边界
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as agentRuntime from "@/features/assistant/model/agentRuntime";
import { AiConnectionSettingsSection } from "@/features/settings/components/AiConnectionSettingsSection";

vi.mock("@/features/assistant/model/agentRuntime", () => ({
  deleteAgentCredential: vi.fn(),
  disconnectChatGpt: vi.fn(),
  getAgentCredentialStatus: vi.fn(),
  getChatGptConnection: vi.fn(),
  saveAgentCredential: vi.fn(),
  validateAgentConnection: vi.fn(),
}));

vi.mock("@/shared/lib/appToast", () => ({ showAppToast: vi.fn() }));

describe("AiConnectionSettingsSection status isolation", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    localStorage.clear();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.mocked(agentRuntime.getChatGptConnection).mockResolvedValue({ connected: true, planType: "plus" });
    vi.mocked(agentRuntime.getAgentCredentialStatus).mockImplementation(async (provider) => ({ provider, configured: false }));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows an existing ChatGPT connection", async () => {
    const onAvailableConnectionsChange = vi.fn();
    await renderConnections(root, onAvailableConnectionsChange);

    expect(container.textContent).toContain("ChatGPT Plus");
    expect(container.querySelector("[data-agent-provider-icon='chatgpt-subscription'] svg")).not.toBeNull();
    expect(container.textContent).not.toContain("尚未添加连接");
    expect(container.querySelector("[aria-label='文本对话']")).not.toBeNull();
    expect(container.querySelector("[aria-label='思考强度']")).not.toBeNull();
    expect(container.querySelector("[aria-label='图片生成']")).not.toBeNull();
    expect(onAvailableConnectionsChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          value: "chatgpt-subscription",
          capabilities: ["text", "reasoning", "imageGeneration"],
        }),
      ]),
    );
  });

  it("marks an existing ChatGPT subscription with a compact check and keeps the add flow closed", async () => {
    await renderConnections(root);

    const addButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("添加连接"));
    await act(async () => {
      addButton?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0 }));
      await Promise.resolve();
    });

    const chatGptItem = Array.from(document.body.querySelectorAll<HTMLElement>("[role='menuitem']")).find((item) =>
      item.textContent?.includes("ChatGPT 订阅"),
    );
    expect(chatGptItem?.getAttribute("aria-disabled")).toBe("true");
    expect(chatGptItem?.querySelector("[aria-label='已添加']")).not.toBeNull();
    expect(document.body.querySelector("[role='dialog']")).toBeNull();
  });

  it("keeps ChatGPT visible when another Provider status read fails", async () => {
    vi.mocked(agentRuntime.getAgentCredentialStatus).mockImplementation(async (provider) => {
      if (provider === "anthropic-api") throw new Error("Anthropic status failed");
      return { provider, configured: false };
    });
    await renderConnections(root);

    expect(container.textContent).toContain("ChatGPT Plus");
    expect(container.textContent).not.toContain("尚未添加连接");
  });

  it("does not advertise image generation for ChatGPT Free", async () => {
    vi.mocked(agentRuntime.getChatGptConnection).mockResolvedValue({ connected: true, planType: "free" });
    const onAvailableConnectionsChange = vi.fn();
    await renderConnections(root, onAvailableConnectionsChange);

    expect(container.querySelector("[aria-label='文本对话']")).not.toBeNull();
    expect(container.querySelector("[aria-label='思考强度']")).not.toBeNull();
    expect(container.querySelector("[aria-label='图片生成']")).toBeNull();
    expect(onAvailableConnectionsChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          value: "chatgpt-subscription",
          capabilities: ["text", "reasoning"],
        }),
      ]),
    );
  });
});

async function renderConnections(root: Root, onAvailableConnectionsChange = vi.fn()) {
  await act(async () => {
    root.render(
      createElement(AiConnectionSettingsSection, {
        agentProvider: "chatgpt-subscription",
        providerBaseUrl: "",
        onAgentProviderChange: vi.fn(),
        onProviderBaseUrlChange: vi.fn(),
        onAvailableConnectionsChange,
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}
