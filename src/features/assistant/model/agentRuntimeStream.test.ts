// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 Vitest、Tauri invoke/listen mock 与 Agent stream 请求契约
 * [OUTPUT]: 验证通用 stream 把会话身份、附件和用户明确授权的本地目录完整交给 native Runtime
 * [POS]: assistant model 的 Runtime IPC 契约回归测试，防止 renderer 与 Tauri command 参数漂移
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { streamAgentChat } from "@/features/assistant/model/agentRuntime";

type DoneEvent = { payload: { requestId: string; sequence: number; emittedAtMs: number; kind: "done" } };

const eventHandler: { current?: (event: DoneEvent) => void } = {};

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn() }));

describe("streamAgentChat native transport", () => {
  beforeEach(() => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", { configurable: true, value: {} });
    eventHandler.current = undefined;
    vi.mocked(invoke).mockReset();
    vi.mocked(listen).mockReset();
    vi.mocked(listen).mockImplementation(async (_event, callback) => {
      eventHandler.current = callback as unknown as (event: DoneEvent) => void;
      return () => undefined;
    });
    vi.mocked(invoke).mockImplementation(async (command, args) => {
      if (command === "start_agent_chat_stream") {
        eventHandler.current?.({
          payload: {
            requestId: String((args as { requestId: string }).requestId),
            sequence: 1,
            emittedAtMs: 1,
            kind: "done",
          },
        });
      }
      return undefined;
    });
  });

  afterEach(() => {
    delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  });

  it("passes conversation identity, attachments, and an empty local directory scope", async () => {
    await streamAgentChat({
      libraryPath: "/tmp/library",
      provider: "openai-api",
      prompt: "继续把标题压低一点",
      context: "主题上下文",
      conversationMessages: [{ id: "theme-user-1", role: "user", content: "先换成墨绿色" }],
      conversationId: "wechat-theme:theme-1:chat-1",
      attachmentPaths: ["/tmp/reference.png"],
      runtime: { model: "auto", reasoningEffort: "medium", quickMode: false, executionMode: "autonomous-read" },
      onDelta: vi.fn(),
    });

    expect(invoke).toHaveBeenCalledWith(
      "start_agent_chat_stream",
      expect.objectContaining({
        conversationMessages: [{ id: "theme-user-1", role: "user", content: "先换成墨绿色" }],
        conversationId: "wechat-theme:theme-1:chat-1",
        attachmentPaths: ["/tmp/reference.png"],
        localDirectoryPaths: [],
      }),
    );
  });

  it("passes only user-provided local directory paths to the native stream", async () => {
    await streamAgentChat({
      libraryPath: "/tmp/library",
      provider: "openai-api",
      prompt: "/Users/geekmai/Documents/Code/obsidian-wechat-style-exporter\n读取这个目录里的主题样式",
      context: "主题上下文",
      conversationMessages: [],
      runtime: { model: "auto", reasoningEffort: "medium", quickMode: false, executionMode: "autonomous-read" },
      onDelta: vi.fn(),
    });

    expect(invoke).toHaveBeenCalledWith(
      "start_agent_chat_stream",
      expect.objectContaining({
        localDirectoryPaths: ["/Users/geekmai/Documents/Code/obsidian-wechat-style-exporter"],
      }),
    );
  });
});
