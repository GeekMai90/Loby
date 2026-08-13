/**
 * [INPUT]: 依赖 Vitest、Assistant Composer 纯规则与 shared Provider 模型目录契约
 * [OUTPUT]: 验证输入法/发送快捷键、slash prompt 与 mention 触发边界、模型能力收敛行为
 * [POS]: assistant/model 的纯规则回归测试，不挂载编辑器或真实 Provider
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { describe, expect, it } from "vitest";
import {
  formatReasoningLevel,
  formatCompactModelLabel,
  getDocumentMentionTrigger,
  getReasoningLevels,
  getSkillSlashTrigger,
  insertQuickPromptAtTrigger,
  isImeCompositionKey,
  resolveModelCatalogSelection,
  shouldSubmitAssistantComposer,
} from "@/features/assistant/model/assistantComposer";
import type { AgentModelCatalog } from "@/shared/types";

describe("assistant composer IME handling", () => {
  it("ignores keys while the composer is tracking an active composition", () => {
    expect(isImeCompositionKey({ isComposing: false }, true)).toBe(true);
  });

  it("ignores keys marked as composing by the browser", () => {
    expect(isImeCompositionKey({ isComposing: true })).toBe(true);
  });

  it("recognizes the WebKit IME fallback key code", () => {
    expect(isImeCompositionKey({ isComposing: false, keyCode: 229 })).toBe(true);
  });

  it("allows an ordinary Enter key to continue to the send handler", () => {
    expect(isImeCompositionKey({ isComposing: false, keyCode: 13 })).toBe(false);
  });
});

describe("assistant composer send shortcut", () => {
  it("uses Enter by default while keeping Shift+Enter for a newline", () => {
    expect(shouldSubmitAssistantComposer({ key: "Enter", metaKey: false, ctrlKey: false, shiftKey: false }, "enter")).toBe(true);
    expect(shouldSubmitAssistantComposer({ key: "Enter", metaKey: false, ctrlKey: false, shiftKey: true }, "enter")).toBe(false);
  });

  it("requires Command+Enter on macOS in mod-enter mode", () => {
    expect(shouldSubmitAssistantComposer({ key: "Enter", metaKey: false, ctrlKey: true, shiftKey: false }, "mod-enter", "mac")).toBe(false);
    expect(shouldSubmitAssistantComposer({ key: "Enter", metaKey: true, ctrlKey: false, shiftKey: false }, "mod-enter", "mac")).toBe(true);
  });

  it("requires Ctrl+Enter on Windows and Linux in mod-enter mode", () => {
    expect(shouldSubmitAssistantComposer({ key: "Enter", metaKey: true, ctrlKey: false, shiftKey: false }, "mod-enter", "other")).toBe(
      false,
    );
    expect(shouldSubmitAssistantComposer({ key: "Enter", metaKey: false, ctrlKey: true, shiftKey: false }, "mod-enter", "other")).toBe(
      true,
    );
  });

  it("does not submit for other keys", () => {
    expect(shouldSubmitAssistantComposer({ key: "Tab", metaKey: true, ctrlKey: false, shiftKey: false }, "mod-enter")).toBe(false);
  });
});

describe("assistant composer quick prompts", () => {
  it("replaces only the active slash query and keeps surrounding text", () => {
    const value = "请帮我 /润色 后面的说明";
    const trigger = getSkillSlashTrigger(value, "请帮我 /润色".length);
    expect(trigger).not.toBeNull();
    expect(insertQuickPromptAtTrigger(value, trigger!, "请润色当前文章，保持原意。")).toEqual({
      value: "请帮我 请润色当前文章，保持原意。 后面的说明",
      cursor: "请帮我 请润色当前文章，保持原意。".length,
    });
  });

  it("opens the slash suggestions for the ideographic comma a Chinese IME puts on screen", () => {
    const value = "请帮我 、润色";
    expect(getSkillSlashTrigger(value, value.length)).toEqual({ from: 4, to: value.length, query: "润色" });
  });
});

describe("assistant composer document mentions", () => {
  it("keeps the mention query anchored at the at sign", () => {
    const value = "参考 @基准";
    expect(getDocumentMentionTrigger(value, value.length)).toEqual({ from: 3, to: value.length, query: "基准" });
  });

  it("ends the mention query at any slash trigger character so the two menus stay exclusive", () => {
    for (const character of ["/", "、", "／"]) {
      const value = `参考 @基准${character}`;
      expect(getDocumentMentionTrigger(value, value.length)).toBeNull();
    }
  });
});

describe("assistant composer model capabilities", () => {
  it.each([
    ["chatgpt-subscription", "GPT-5.6 Sol", "5.6 Sol"],
    ["anthropic-api", "Claude Opus 4.7", "Opus 4.7"],
    ["qwen-api", "Qwen3-Max", "3 Max"],
    ["minimax-api", "MiniMax M2.1", "M2.1"],
    ["deepseek-api", "DeepSeek-V3.2", "V3.2"],
    ["kimi-api", "Kimi K2.6", "K2.6"],
  ] as const)("removes the repeated Provider name from %s compact labels", (provider, label, expected) => {
    expect(formatCompactModelLabel(provider, label)).toBe(expected);
  });

  it("localizes every reasoning level advertised by current ChatGPT models", () => {
    expect(["none", "minimal", "low", "medium", "high", "xhigh", "max", "ultra"].map(formatReasoningLevel)).toEqual([
      "关闭",
      "最小",
      "低",
      "中",
      "高",
      "极高",
      "最高",
      "极致",
    ]);
  });

  it("does not invent reasoning controls for a model that rejects reasoning parameters", () => {
    const catalog: AgentModelCatalog = {
      fetchedAt: "",
      currentModel: "custom",
      currentReasoningEffort: "medium",
      models: [
        {
          slug: "custom",
          displayName: "自定义模型",
          description: "",
          contextWindowTokens: 64_000,
          supportsReasoning: false,
          defaultReasoningLevel: "",
          supportedReasoningLevels: [],
          additionalSpeedTiers: [],
          serviceTiers: [],
        },
      ],
    };

    expect(getReasoningLevels(catalog, "custom", "medium")).toEqual([]);
    expect(resolveModelCatalogSelection(catalog, "stale-model", "high")).toEqual({ model: "custom", reasoningEffort: "" });
  });

  it("uses the selected model default when the previous Provider reasoning level is unsupported", () => {
    const catalog: AgentModelCatalog = {
      fetchedAt: "",
      currentModel: "reasoning-model",
      currentReasoningEffort: "medium",
      models: [
        {
          slug: "reasoning-model",
          displayName: "Reasoning Model",
          description: "",
          contextWindowTokens: 128_000,
          supportsReasoning: true,
          defaultReasoningLevel: "medium",
          supportedReasoningLevels: ["low", "medium", "high"].map((effort) => ({ effort, description: effort })),
          additionalSpeedTiers: [],
          serviceTiers: [],
        },
      ],
    };

    expect(resolveModelCatalogSelection(catalog, "reasoning-model", "xhigh")).toEqual({
      model: "reasoning-model",
      reasoningEffort: "medium",
    });
  });

  it("does not invent a strength selector for fixed provider reasoning", () => {
    const catalog: AgentModelCatalog = {
      fetchedAt: "",
      currentModel: "fixed-reasoning",
      currentReasoningEffort: "",
      models: [
        {
          slug: "fixed-reasoning",
          displayName: "Fixed Reasoning",
          description: "",
          contextWindowTokens: 204_800,
          supportsReasoning: true,
          defaultReasoningLevel: "",
          supportedReasoningLevels: [],
          additionalSpeedTiers: [],
          serviceTiers: [],
        },
      ],
    };

    expect(getReasoningLevels(catalog, "fixed-reasoning", "")).toEqual([]);
  });
});
