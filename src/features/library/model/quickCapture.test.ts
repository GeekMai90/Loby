import { describe, expect, it } from "vitest";
import {
  clearQuickCaptureDraft,
  createQuickCaptureDocument,
  createQuickCaptureTitle,
  loadQuickCaptureDraft,
  saveQuickCaptureDraft,
} from "@/features/library/model/quickCapture";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

describe("quick capture", () => {
  it("persists a draft until it is cleared", () => {
    const storage = new MemoryStorage();

    saveQuickCaptureDraft("还没发送的想法", storage);
    expect(loadQuickCaptureDraft(storage)).toBe("还没发送的想法");

    clearQuickCaptureDraft(storage);
    expect(loadQuickCaptureDraft(storage)).toBe("");
  });

  it("treats manually emptied content as a cleared draft", () => {
    const storage = new MemoryStorage();
    saveQuickCaptureDraft("临时内容", storage);

    saveQuickCaptureDraft("", storage);

    expect(loadQuickCaptureDraft(storage)).toBe("");
  });

  it("creates a local minute timestamp title", () => {
    expect(createQuickCaptureTitle(new Date(2026, 6, 18, 15, 49, 27))).toBe("202607181549");
  });

  it("uses the same timestamp for the document title and first heading", () => {
    expect(createQuickCaptureDocument("  刚刚想到的内容\n下一行  ", new Date(2026, 6, 18, 15, 49, 27))).toEqual({
      title: "202607181549",
      body: "# 202607181549\n\n刚刚想到的内容\n下一行",
    });
  });
});
