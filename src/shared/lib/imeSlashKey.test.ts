/**
 * [INPUT]: 依赖 Vitest 与 shared/lib/imeSlashKey 纯规则
 * [OUTPUT]: 验证 Slash 键上屏的 IME 替身被归一为 `/`、Backslash 键上屏的顿号原样保留，以及键位记录过期后不再归一
 * [POS]: shared 斜杠键归一边界的纯规则回归，不挂载 CodeMirror 或 composer
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { describe, expect, it } from "vitest";
import { createSlashKeyTracker, isSlashKeyImeVariant, normalizeSlashKeyInput } from "@/shared/lib/imeSlashKey";

function createClock(start = 1_000) {
  let current = start;
  return {
    read: () => current,
    advance(ms: number) {
      current += ms;
    },
  };
}

describe("ime slash key", () => {
  it("recognizes only the single-character variants the slash key can produce", () => {
    expect(isSlashKeyImeVariant("、")).toBe(true);
    expect(isSlashKeyImeVariant("／")).toBe(true);
    expect(isSlashKeyImeVariant("/")).toBe(false);
    expect(isSlashKeyImeVariant("、、")).toBe(false);
    expect(isSlashKeyImeVariant("")).toBe(false);
  });

  it("rewrites the variants the slash key put on screen back to a halfwidth slash", () => {
    for (const variant of ["、", "／"]) {
      const clock = createClock();
      const tracker = createSlashKeyTracker(clock.read);
      tracker.observeKeyDown({ code: "Slash" });
      clock.advance(20);
      const value = `正文 ${variant}`;
      expect(normalizeSlashKeyInput(value, value.length, tracker)).toBe("正文 /");
    }
  });

  it("keeps the ideographic comma typed on its own physical key", () => {
    const clock = createClock();
    const tracker = createSlashKeyTracker(clock.read);
    tracker.observeKeyDown({ code: "Backslash" });
    clock.advance(20);
    expect(normalizeSlashKeyInput("苹果、", "苹果、".length, tracker)).toBe("苹果、");
  });

  it("normalizes at the cursor rather than at the end of the value", () => {
    const clock = createClock();
    const tracker = createSlashKeyTracker(clock.read);
    tracker.observeKeyDown({ code: "Slash" });
    expect(normalizeSlashKeyInput("、标题 后面的正文", 1, tracker)).toBe("/标题 后面的正文");
  });

  it("stops normalizing once the key press is too old to explain the insertion", () => {
    const clock = createClock();
    const tracker = createSlashKeyTracker(clock.read);
    tracker.observeKeyDown({ code: "Slash" });
    clock.advance(8_000);
    expect(normalizeSlashKeyInput("苹果、", "苹果、".length, tracker)).toBe("苹果、");
  });

  it("never normalizes when the physical key is unknown", () => {
    const tracker = createSlashKeyTracker(createClock().read);
    tracker.observeKeyDown({});
    expect(normalizeSlashKeyInput("苹果、", "苹果、".length, tracker)).toBe("苹果、");
  });

  it("leaves text untouched when the cursor is outside the value", () => {
    const tracker = createSlashKeyTracker(createClock().read);
    tracker.observeKeyDown({ code: "Slash" });
    expect(normalizeSlashKeyInput("、", 0, tracker)).toBe("、");
    expect(normalizeSlashKeyInput("、", 5, tracker)).toBe("、");
  });
});
