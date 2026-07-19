import { describe, expect, it } from "vitest";
import {
  createQuickPrompt,
  filterQuickPromptSuggestions,
  MAX_AI_QUICK_PROMPTS,
  normalizeQuickPromptStore,
  updateQuickPrompt,
} from "./quickPrompts";

describe("quick prompts", () => {
  it("normalizes valid prompts and enforces the library limit", () => {
    const prompts = Array.from({ length: MAX_AI_QUICK_PROMPTS + 3 }, (_, index) => ({
      id: `prompt-${index}`,
      title: ` 提示 ${index} `,
      content: ` 内容 ${index} `,
      createdAt: "2026-07-19T00:00:00.000Z",
      updatedAt: "2026-07-19T00:00:00.000Z",
    }));
    const normalized = normalizeQuickPromptStore({ version: 9, prompts });
    expect(normalized.version).toBe(1);
    expect(normalized.prompts).toHaveLength(MAX_AI_QUICK_PROMPTS);
    expect(normalized.prompts[0].title).toBe("提示 0");
    expect(normalized.prompts[0].content).toBe("内容 0");
  });

  it("creates, updates and searches prompts by title before content", () => {
    const first = createQuickPrompt("润色", "保持原意并优化表达", "2026-07-19T00:00:00.000Z", "prompt-1");
    const second = createQuickPrompt("标题建议", "给出五个润色后的标题", "2026-07-19T00:00:00.000Z", "prompt-2");
    expect(filterQuickPromptSuggestions([second, first], "润色").map((prompt) => prompt.id)).toEqual(["prompt-1", "prompt-2"]);
    expect(updateQuickPrompt(first, "轻度润色", "只修正明显问题", "2026-07-20T00:00:00.000Z")).toMatchObject({
      id: "prompt-1",
      title: "轻度润色",
      content: "只修正明显问题",
      createdAt: "2026-07-19T00:00:00.000Z",
      updatedAt: "2026-07-20T00:00:00.000Z",
    });
  });

  it("drops malformed or empty entries", () => {
    const normalized = normalizeQuickPromptStore({
      prompts: [
        null,
        { id: "", title: "无效", content: "内容" },
        { id: "prompt-1", title: "", content: "内容" },
        { id: "prompt-2", title: "有效", content: "提示内容" },
        { id: "prompt-2", title: "重复", content: "不会保留" },
      ],
    });
    expect(normalized.prompts.map((prompt) => prompt.id)).toEqual(["prompt-2"]);
  });
});
