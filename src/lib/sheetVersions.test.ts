import { describe, expect, it } from "vitest";
import { createSheetVersionSnapshot } from "./sheetVersions";
import type { WritingSheet } from "../types";

describe("sheetVersions", () => {
  it("creates readable snapshots with source labels and word counts", () => {
    const snapshot = createSheetVersionSnapshot(sheet({ title: "第一章", body: "hello world" }), "ai", "AI 修改前");

    expect(snapshot.id).toMatch(/^version-/);
    expect(snapshot.title).toContain("第一章");
    expect(snapshot.title).toContain("AI 修改前");
    expect(snapshot.body).toBe("hello world");
    expect(snapshot.wordCount).toBe(2);
    expect(snapshot.source).toBe("ai");
    expect(snapshot.reason).toBe("AI 修改前");
  });
});

function sheet(overrides: Partial<WritingSheet> = {}): WritingSheet {
  return {
    id: "sheet-1",
    title: "文稿",
    type: "正文",
    status: "构思",
    targetWords: 1000,
    summary: "",
    body: "",
    updatedAt: "2026-07-09T10:00:00+08:00",
    ...overrides,
  };
}
