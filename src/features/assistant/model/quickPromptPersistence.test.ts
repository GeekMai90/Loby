// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from "vitest";
import type { AiQuickPrompt } from "@/shared/types";
import { loadQuickPrompts, saveQuickPrompts } from "@/features/library/model/persistence";

describe("quick prompt browser persistence", () => {
  beforeEach(() => localStorage.clear());

  it("keeps prompts isolated by writing library", async () => {
    const prompt: AiQuickPrompt = {
      id: "prompt-1",
      title: "润色",
      content: "润色当前文稿",
      createdAt: "2026-07-19T00:00:00.000Z",
      updatedAt: "2026-07-19T00:00:00.000Z",
    };

    await saveQuickPrompts([prompt], "browser://library-a");

    await expect(loadQuickPrompts("browser://library-a")).resolves.toEqual([prompt]);
    await expect(loadQuickPrompts("browser://library-b")).resolves.toEqual([]);
  });
});
