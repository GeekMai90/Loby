import { describe, expect, it } from "vitest";
import {
  getReasoningLevels,
  getSkillSlashTrigger,
  insertQuickPromptAtTrigger,
  isImeCompositionKey,
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
});

describe("assistant composer model capabilities", () => {
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
  });
});
