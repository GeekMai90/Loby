// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 Vitest、Tauri invoke mock 与 agentRuntime 连接验证 IPC
 * [OUTPUT]: 验证连接诊断只向原生层传递 Provider 和可选兼容服务地址
 * [POS]: assistant model 的连接验证 IPC 契约回归测试，不模拟真实 Provider 网络
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { generateConversationTitle, validateAgentConnection } from "@/features/assistant/model/agentRuntime";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

describe("validateAgentConnection", () => {
  beforeEach(() => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", { configurable: true, value: {} });
    vi.mocked(invoke).mockReset();
  });

  afterEach(() => {
    delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  });

  it("passes a compatible endpoint to the native validation command", async () => {
    vi.mocked(invoke).mockResolvedValueOnce("自定义服务商已接受当前凭证。");

    await expect(validateAgentConnection("openai-compatible", "https://api.example.com/v1")).resolves.toBe("自定义服务商已接受当前凭证。");

    expect(invoke).toHaveBeenCalledWith("validate_agent_connection", {
      provider: "openai-compatible",
      baseUrl: "https://api.example.com/v1",
    });
  });

  it("does not invent a browser validation result", async () => {
    delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;

    await expect(validateAgentConnection("chatgpt-subscription")).rejects.toThrow("浏览器开发模式不能验证 AI 连接。");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("passes the bounded title request to the native command", async () => {
    vi.mocked(invoke).mockResolvedValueOnce("文章结构整理");

    await expect(
      generateConversationTitle({
        provider: "openai-api",
        prompt: "请概括这次对话",
        conversationMessages: [{ id: "user-1", role: "user", content: "请帮我整理文章结构" }],
        runtime: { model: "gpt-5.6-terra", reasoningEffort: "", quickMode: false, maxOutputTokens: 32 },
      }),
    ).resolves.toBe("文章结构整理");

    expect(invoke).toHaveBeenCalledWith("generate_conversation_title", {
      provider: "openai-api",
      prompt: "请概括这次对话",
      conversationMessages: [{ id: "user-1", role: "user", content: "请帮我整理文章结构" }],
      runtime: { model: "gpt-5.6-terra", reasoningEffort: "", quickMode: false, maxOutputTokens: 32 },
    });
  });
});
