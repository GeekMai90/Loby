// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React DOM、Vitest、ChatGptConnectionSettings、原生 OAuth IPC mock 与 Tauri opener mock
 * [OUTPUT]: 验证 ChatGPT 订阅通过设备码连接且界面永不渲染 token 输入框
 * [POS]: settings 的 ChatGPT 身份回归测试，守住订阅登录和 API key 表单之间的安全边界
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChatGptConnectionSettings } from "@/features/settings/components/ChatGptConnectionSettings";

const { cancelFlowMock, completeFlowMock, connectionMock, openUrlMock, startFlowMock } = vi.hoisted(() => ({
  cancelFlowMock: vi.fn(),
  completeFlowMock: vi.fn(),
  connectionMock: vi.fn(),
  openUrlMock: vi.fn(),
  startFlowMock: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: openUrlMock }));
vi.mock("@/features/assistant/model/agentRuntime", () => ({
  cancelChatGptDeviceFlow: cancelFlowMock,
  getChatGptConnection: connectionMock,
  startChatGptDeviceFlow: startFlowMock,
  completeChatGptDeviceFlow: completeFlowMock,
  disconnectChatGpt: vi.fn(),
}));

describe("ChatGptConnectionSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    connectionMock.mockResolvedValue({ connected: false, planType: "" });
    startFlowMock.mockResolvedValue({
      flowId: "flow-1",
      userCode: "ABCD-EFGH",
      verificationUri: "https://auth.openai.com/codex/device",
      expiresIn: 600,
    });
    completeFlowMock.mockResolvedValue({ connected: true, planType: "plus" });
    openUrlMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  it("connects a subscription account without exposing a token field", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(ChatGptConnectionSettings));
      await Promise.resolve();
    });
    const login = [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) =>
      button.textContent?.includes("登录 ChatGPT"),
    );
    await act(async () => {
      login?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(startFlowMock).toHaveBeenCalledOnce();
    expect(completeFlowMock).toHaveBeenCalledWith(expect.objectContaining({ flowId: "flow-1" }));
    expect(openUrlMock).toHaveBeenCalledWith("https://auth.openai.com/codex/device");
    expect(container.textContent).not.toContain("writer@example.com");
    expect(container.textContent).toContain("Plus");
    expect(container.querySelector('input[type="password"]')).toBeNull();

    await act(async () => root.unmount());
  });

  it("cancels native polling when the user stops login", async () => {
    completeFlowMock.mockReturnValue(new Promise(() => {}));
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(ChatGptConnectionSettings));
      await Promise.resolve();
    });
    const login = [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) =>
      button.textContent?.includes("登录 ChatGPT"),
    );
    await act(async () => {
      login?.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    const cancel = [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.includes("取消"));
    await act(async () => {
      cancel?.click();
      await Promise.resolve();
    });

    expect(cancelFlowMock).toHaveBeenCalledWith(expect.objectContaining({ flowId: "flow-1" }));
    expect(container.textContent).toContain("登录 ChatGPT");

    await act(async () => root.unmount());
  });
});
