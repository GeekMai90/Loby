import { describe, expect, it } from "vitest";
import { buildSkillContext, resolveSkillMentions, usesPluginCapabilities } from "@/features/assistant/model/agentCommands";
import type { CodexSkill } from "@/shared/types";

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

  it("resolves a uniquely named skill from natural language without requiring a dollar mention", () => {
    const skills: CodexSkill[] = [
      {
        id: "every-editorial-cover",
        name: "every-editorial-cover",
        description: "Every 风格封面",
        path: "/Users/example/.agents/skills/every-editorial-cover/SKILL.md",
      },
      {
        id: "write-cover",
        name: "write-cover",
        description: "通用文章封面",
        path: "/Users/example/.agents/skills/write-cover/SKILL.md",
      },
    ];

    expect(resolveSkillMentions("使用 Every 技能帮我创建一张封面图", skills, [])).toEqual([skills[0]]);
    expect(resolveSkillMentions("请运行 every-editorial-cover 帮我创建封面", skills, [])).toEqual([skills[0]]);
    expect(resolveSkillMentions("Every day 都要写作", skills, [])).toEqual([]);
  });

  it("does not guess when a natural-language skill alias is ambiguous", () => {
    const skills: CodexSkill[] = [
      {
        id: "write-cover",
        name: "write-cover",
        description: "通用封面",
        path: "/skills/write-cover/SKILL.md",
      },
      {
        id: "every-cover",
        name: "every-cover",
        description: "Every 封面",
        path: "/skills/every-cover/SKILL.md",
      },
    ];

    expect(resolveSkillMentions("使用 cover 技能", skills, [])).toEqual([]);
  });

  it("enables ambient plugin capabilities for a resolved plugin skill", () => {
    expect(
      usesPluginCapabilities([
        {
          id: "github",
          name: "github",
          description: "GitHub workflow",
          path: "/Users/example/.codex/plugins/cache/github/skills/github/SKILL.md",
        },
      ]),
    ).toBe(true);
    expect(
      usesPluginCapabilities([
        {
          id: "write-headline",
          name: "write-headline",
          description: "生成标题",
          path: "/Users/example/.agents/skills/write-headline/SKILL.md",
        },
      ]),
    ).toBe(false);
  });
});
