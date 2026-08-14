/**
 * [INPUT]: 依赖 Vitest 与 shared/lib/slashTrigger 纯规则
 * [OUTPUT]: 验证半角斜杠的触发边界，以及顿号、全角斜杠等其他标点不触发
 * [POS]: shared slash 触发边界的纯规则回归，不挂载 CodeMirror 或 composer
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { describe, expect, it } from "vitest";
import { findSlashTriggerAt } from "@/shared/lib/slashTrigger";

describe("slash trigger", () => {
  it("opens at a halfwidth slash on the line start or after whitespace", () => {
    expect(findSlashTriggerAt("/标题", "/标题".length)).toEqual({ from: 0, to: 3, query: "标题" });
    expect(findSlashTriggerAt("正文 /h1", "正文 /h1".length)).toEqual({ from: 3, to: 6, query: "h1" });
  });

  it("only recognizes the halfwidth slash", () => {
    for (const punctuation of ["、", "／"]) {
      expect(findSlashTriggerAt(`${punctuation}标题`, 3)).toBeNull();
      expect(findSlashTriggerAt(`苹果${punctuation}香蕉`, 5)).toBeNull();
    }
  });

  it("ignores a slash glued to preceding text so paths never open the menu", () => {
    expect(findSlashTriggerAt("src/shared", "src/shared".length)).toBeNull();
  });

  it("closes the trigger once whitespace or another slash follows", () => {
    expect(findSlashTriggerAt("/标题 ", "/标题 ".length)).toBeNull();
    expect(findSlashTriggerAt("//", 2)).toBeNull();
  });

  it("reads the trigger at the cursor, not at the end of the value", () => {
    const value = "/h1 后面的正文";
    expect(findSlashTriggerAt(value, 3)).toEqual({ from: 0, to: 3, query: "h1" });
  });
});
