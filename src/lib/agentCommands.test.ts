import { describe, expect, it } from "vitest";
import { buildSkillContext } from "./agentCommands";
import type { CodexSkill } from "../types";

describe("agentCommands", () => {
  it("includes loaded skill instructions in the prompt context", () => {
    const skill: CodexSkill = {
      id: "write-headline",
      name: "write-headline",
      description: "生成标题",
      path: "/Users/example/.agents/skills/write-headline/SKILL.md",
      instructions: "# Write Headline\n\n先读取当前文章，再生成标题。",
      instructionsTruncated: false,
    };

    const context = buildSkillContext([skill]);

    expect(context).toContain("已读取到 instructions 时，必须按该 Skill 的工作流执行");
    expect(context).toContain("路径：/Users/example/.agents/skills/write-headline/SKILL.md");
    expect(context).toContain("# Write Headline");
    expect(context).toContain("先读取当前文章，再生成标题。");
    expect(context).toContain("````markdown");
  });

  it("falls back to metadata when instructions are not loaded", () => {
    const context = buildSkillContext([
      {
        id: "skill",
        name: "skill",
        description: "",
        path: "/tmp/SKILL.md",
      },
    ]);

    expect(context).toContain("Skill.md：未读取，仅提供元信息。");
  });
});
