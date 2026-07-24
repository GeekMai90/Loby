/**
 * [INPUT]: 依赖 documentId 文稿身份规则
 * [OUTPUT]: 验证 26 位 Base32 文稿 ID 的格式、唯一性与公开部分
 * [POS]: library model 的文稿身份回归测试
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { describe, expect, it } from "vitest";
import { createSheetId, isCanonicalSheetId, sheetPublicId } from "@/features/library/model/documentId";

describe("documentId", () => {
  it("creates canonical lowercase Base32 sheet ids", () => {
    const id = createSheetId();
    expect(id).toMatch(/^sheet-[0-9a-hjkmnp-tv-z]{26}$/);
    expect(isCanonicalSheetId(id)).toBe(true);
    expect(sheetPublicId(id)).toBe(id.slice("sheet-".length));
  });

  it("does not reuse ids and rejects legacy formats", () => {
    expect(new Set(Array.from({ length: 100 }, () => createSheetId())).size).toBe(100);
    expect(isCanonicalSheetId("sheet-550e8400-e29b-41d4-a716-446655440000")).toBe(false);
    expect(isCanonicalSheetId("sheet-import-1783648800000-0")).toBe(false);
    expect(sheetPublicId("sheet-old")).toBeNull();
  });
});
