/**
 * [INPUT]: 依赖 Vitest、内存 localStorage 与 agentSettings 归一化/持久化接口
 * [OUTPUT]: 验证 AI、编辑器、写作与窗口设置的默认值、迁移和往返存储
 * [POS]: 应用级 AgentSettings 的持久化回归测试，覆盖固定侧边布尔设置、rail 折叠模式与旧形态迁移
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadAgentSettings, saveAgentSettings } from "@/features/assistant/model/agentSettings";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe("agent settings", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", new MemoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults the assistant send shortcut to Enter", () => {
    expect(loadAgentSettings().assistantSendMode).toBe("enter");
  });

  it("defaults the sidebar collapse mode to navigation-only and persists linked mode", () => {
    expect(loadAgentSettings().sidebarCollapseMode).toBe("navigation-only");
    saveAgentSettings({ sidebarCollapseMode: "navigation-and-list" });
    expect(loadAgentSettings().sidebarCollapseMode).toBe("navigation-and-list");
  });

  it("normalizes an unknown sidebar collapse mode to navigation-only", () => {
    localStorage.setItem("loby.agentSettings.v1", JSON.stringify({ sidebarCollapseMode: "unknown" }));
    expect(loadAgentSettings().sidebarCollapseMode).toBe("navigation-only");
  });

  it("defaults the assistant to pinned and persists an unchecked preference", () => {
    expect(loadAgentSettings().assistantDockedByDefault).toBe(true);
    saveAgentSettings({ assistantDockedByDefault: false });
    expect(loadAgentSettings().assistantDockedByDefault).toBe(false);
  });

  it("defaults goal celebrations on and persists the user's choice", () => {
    expect(loadAgentSettings().goalCelebrationEnabled).toBe(true);
    saveAgentSettings({ goalCelebrationEnabled: false });
    expect(loadAgentSettings().goalCelebrationEnabled).toBe(false);
  });

  it("persists Markdown preview as a writing preference", () => {
    expect(loadAgentSettings().sheetPreviewMode).toBe(false);
    saveAgentSettings({ sheetPreviewMode: true });
    expect(loadAgentSettings().sheetPreviewMode).toBe(true);
  });

  it("persists the Command+Enter send shortcut", () => {
    saveAgentSettings({ assistantSendMode: "mod-enter" });
    expect(loadAgentSettings().assistantSendMode).toBe("mod-enter");
  });

  it("persists Markdown formatting choices and fills missing choices with defaults", () => {
    saveAgentSettings({
      markdownFormatting: {
        formatOnSave: true,
        cleanupWhitespace: false,
        normalizeBlockSpacing: true,
        normalizeMarkdownMarkers: true,
        spaceCjkAndLatin: false,
        fullWidthPunctuation: true,
      },
    });
    expect(loadAgentSettings().markdownFormatting).toEqual({
      formatOnSave: true,
      cleanupWhitespace: false,
      normalizeBlockSpacing: true,
      normalizeMarkdownMarkers: true,
      spaceCjkAndLatin: false,
      fullWidthPunctuation: true,
    });

    localStorage.setItem("loby.agentSettings.v1", JSON.stringify({ markdownFormatting: { cleanupWhitespace: false } }));
    expect(loadAgentSettings().markdownFormatting).toEqual({
      formatOnSave: false,
      cleanupWhitespace: false,
      normalizeBlockSpacing: true,
      normalizeMarkdownMarkers: true,
      spaceCjkAndLatin: true,
      fullWidthPunctuation: true,
    });
  });

  it("normalizes an unknown persisted shortcut to Enter", () => {
    localStorage.setItem("loby.agentSettings.v1", JSON.stringify({ assistantSendMode: "unknown" }));
    expect(loadAgentSettings().assistantSendMode).toBe("enter");
  });

  it("migrates the former explicit floating preference to unchecked", () => {
    localStorage.setItem("loby.agentSettings.v1", JSON.stringify({ assistantPresentationPreference: "floating" }));
    expect(loadAgentSettings().assistantDockedByDefault).toBe(false);

    localStorage.setItem("loby.agentSettings.v1", JSON.stringify({ assistantPresentationPreference: "auto" }));
    expect(loadAgentSettings().assistantDockedByDefault).toBe(true);
  });

  it("persists the selected Provider and compatible API address", () => {
    saveAgentSettings({ agentProvider: "openai-compatible", providerBaseUrl: "https://api.example.com/v1" });
    expect(loadAgentSettings().agentProvider).toBe("openai-compatible");
    expect(loadAgentSettings().providerBaseUrl).toBe("https://api.example.com/v1");
    localStorage.setItem("loby.agentSettings.v1", JSON.stringify({ agentProvider: "claude-subscription" }));
    expect(loadAgentSettings().agentProvider).toBe("openai-api");
  });

  it.each(["qwen-api", "minimax-api", "deepseek-api", "kimi-api"] as const)("persists the %s Provider", (agentProvider) => {
    saveAgentSettings({ agentProvider });
    expect(loadAgentSettings().agentProvider).toBe(agentProvider);
  });

  it("keeps the model and reasoning defaults across a reload", () => {
    saveAgentSettings({ agentModel: "gpt-5.6-luna", agentReasoningEffort: "high" });

    expect(loadAgentSettings()).toMatchObject({
      agentModel: "gpt-5.6-luna",
      agentReasoningEffort: "high",
    });
  });

  it("defaults image generation to automatic routing and persists an explicit service", () => {
    expect(loadAgentSettings().imageGenerationProvider).toBe("auto");
    saveAgentSettings({ imageGenerationProvider: "chatgpt-subscription" });
    expect(loadAgentSettings().imageGenerationProvider).toBe("chatgpt-subscription");
    localStorage.setItem("loby.agentSettings.v1", JSON.stringify({ imageGenerationProvider: "unknown" }));
    expect(loadAgentSettings().imageGenerationProvider).toBe("auto");
  });

  it("drops retired assistant settings", () => {
    localStorage.setItem(
      "loby.agentSettings.v1",
      JSON.stringify({
        planMode: true,
        agentProvider: "claude",
        claudeCliPath: "/usr/local/bin/claude",
        imageReferenceFormat: "obsidian",
      }),
    );

    const settings = loadAgentSettings();
    expect(settings).not.toHaveProperty("planMode");
    expect(settings.agentProvider).toBe("openai-api");
    expect(settings).not.toHaveProperty("claudeCliPath");
    expect(settings).not.toHaveProperty("imageReferenceFormat");
  });
});
