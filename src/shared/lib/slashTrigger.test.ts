/**
 * [INPUT]: 依赖 Vitest 与 shared/lib/slashTrigger 纯规则
 * [OUTPUT]: 验证半角斜杠、Windows 中文输入法顿号与全角斜杠的等价触发，以及中文顿号正常书写不误触
 * [POS]: shared slash 触发边界的纯规则回归，不挂载 CodeMirror 或 composer
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { describe, expect, it } from "vitest";
import { findSlashTriggerAt } from "@/shared/lib/slashTrigger";

describe("slash trigger", () => {
  it("treats halfwidth slash, ideographic comma and fullwidth slash as the same trigger", () => {
    for (const character of ["/", "、", "／"]) {
      const value = `${character}标题`;
      expect(findSlashTriggerAt(value, value.length)).toEqual({ from: 0, to: value.length, query: "标题" });
    }
  });

  it("keeps the trigger anchored at the trigger character after leading text", () => {
    const value = "正文 、h1";
    expect(findSlashTriggerAt(value, value.length)).toEqual({ from: 3, to: value.length, query: "h1" });
  });

  it("ignores an ideographic comma used as normal Chinese punctuation", () => {
    const value = "苹果、香蕉";
    expect(findSlashTriggerAt(value, value.length)).toBeNull();
  });

  it("closes the trigger once whitespace or another trigger character follows", () => {
    expect(findSlashTriggerAt("、标题 ", "、标题 ".length)).toBeNull();
    expect(findSlashTriggerAt("、、", 2)).toBeNull();
    expect(findSlashTriggerAt("//", 2)).toBeNull();
  });

  it("reads the trigger at the cursor, not at the end of the value", () => {
    const value = "、h1 后面的正文";
    expect(findSlashTriggerAt(value, 3)).toEqual({ from: 0, to: 3, query: "h1" });
  });
});
