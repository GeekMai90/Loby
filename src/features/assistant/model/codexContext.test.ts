import { describe, expect, it } from "vitest";
import type { ChatMessage, WritingProject, WritingSheet } from "@/shared/types";
import { buildCodexContext, buildCodexContextPayload } from "@/features/assistant/model/codexContext";

describe("codexContext", () => {
  it("includes Loby writing structure and document outline context", () => {
    const sheet: WritingSheet = {
      id: "sheet-1",
      title: "第一篇",
      groupId: "group-main",
      status: "构思",
      targetWords: 1000,
      summary: "当前稿件摘要",
      body: "# 开头\n\n正文第一段。\n\n## 案例\n\n正文第二段。",
      updatedAt: "2026-07-09",
    };
    const project: WritingProject = {
      id: "project-1",
      title: "写作项目",
      description: "项目描述",
      status: "构思",
      targetPlatform: "公众号",
      targetWords: 3000,
      tags: [],
      groups: [{ id: "group-main", title: "正文" }],
      sheets: [sheet],
      updatedAt: "2026-07-09",
      writingBrief: {
        audience: "专业读者",
        thesis: "核心观点",
        tone: "克制",
        publishingNotes: "发布备注",
      },
    };

    const context = buildCodexContext(
      project,
      sheet,
      "选区文本",
      [],
      [],
      [],
      [],
      { provider: "codex", model: "auto", reasoningEffort: "medium", quickMode: false },
      "/Users/example/LobyLibrary",
      null,
    );

    expect(context).toContain("### 当前写作结构");
    expect(context).toContain("当前文稿：第一篇；字数：14 / 1000");
    expect(context).toContain("### 当前文稿轮廓");
    expect(context).toContain("- H1 L1: 开头");
    expect(context).toContain("  - H2 L5: 案例");
    expect(context).toContain("当前选区：4 字");
    expect(context).toContain("### 落笔（Loby）操作说明");
  });

  it("does not duplicate current sheet body when the current document is already mounted", () => {
    const { project, sheet } = fixture();
    const context = buildCodexContext(
      project,
      sheet,
      "",
      [],
      ["current-sheet"],
      [],
      [
        {
          id: "document:sheet-1",
          type: "document",
          projectId: "project-1",
          sheetId: "sheet-1",
          title: "第一篇",
          subtitle: "当前文稿",
          content: sheet.body,
        },
      ],
      { provider: "codex", model: "auto", reasoningEffort: "medium", quickMode: false },
      "/Users/example/LobyLibrary",
      null,
    );

    expect(countOccurrences(context, "唯一正文片段")).toBe(1);
    expect(context).toContain("### 已挂载上下文");
    expect(context).not.toContain("### 当前稿件正文\n# 开头");
  });

  it("keeps current sheet body when it is requested through mention modes only", () => {
    const { project, sheet } = fixture();
    const context = buildCodexContext(
      project,
      sheet,
      "",
      [],
      ["current-sheet"],
      [],
      [],
      { provider: "codex", model: "auto", reasoningEffort: "medium", quickMode: false },
      "/Users/example/LobyLibrary",
      null,
    );

    expect(context).toContain("### 当前稿件正文");
    expect(countOccurrences(context, "唯一正文片段")).toBe(1);
  });

  it("reuses an unchanged thread snapshot without resending document bodies or conversation history", () => {
    const { project, sheet } = fixture();
    const messages: ChatMessage[] = [
      { id: "user-1", role: "user", content: "请先分析全文" },
      { id: "assistant-1", role: "assistant", content: "这是上轮回答" },
    ];
    const input = {
      project,
      sheet,
      selectedText: "",
      messages,
      mentionModes: ["current-sheet" as const],
      skills: [],
      mountedContexts: [
        {
          id: "document:sheet-1",
          type: "document" as const,
          projectId: "project-1",
          sheetId: "sheet-1",
          title: "第一篇",
          subtitle: "当前文稿",
          content: sheet.body,
        },
      ],
      agentRuntime: { provider: "codex" as const, model: "auto", reasoningEffort: "medium", quickMode: false },
      libraryPath: "/Users/example/LobyLibrary",
      resourcePaths: null,
    };
    const initial = buildCodexContextPayload(input);
    const resumed = buildCodexContextPayload({
      ...input,
      selectedText: "选区文字",
      skills: [{ id: "polish", name: "polish", description: "润色", path: "/skills/polish", instructions: "保持原意" }],
      syncedStableSignature: initial.stableSignature,
      includeRecentMessages: false,
    });

    expect(initial.context).toContain("唯一正文片段");
    expect(initial.context).toContain("最近对话");
    expect(resumed.reusedStableContext).toBe(true);
    expect(resumed.context).toContain("沿用本会话最近一次已同步快照");
    expect(resumed.context).toContain("当前选区：\n选区文字");
    expect(resumed.context).toContain("保持原意");
    expect(resumed.context).not.toContain("唯一正文片段");
    expect(resumed.context).not.toContain("最近对话");
    expect(resumed.context).not.toContain("这是上轮回答");
  });

  it("resends the stable snapshot after mounted document content changes", () => {
    const { project, sheet } = fixture();
    const mountedContext = {
      id: "document:sheet-1",
      type: "document" as const,
      projectId: "project-1",
      sheetId: "sheet-1",
      title: "第一篇",
      subtitle: "当前文稿",
      content: sheet.body,
    };
    const input = {
      project,
      sheet,
      selectedText: "",
      messages: [],
      mentionModes: ["current-sheet" as const],
      skills: [],
      mountedContexts: [mountedContext],
      agentRuntime: { provider: "codex" as const, model: "auto", reasoningEffort: "medium", quickMode: false },
      libraryPath: "/Users/example/LobyLibrary",
      resourcePaths: null,
    };
    const initial = buildCodexContextPayload(input);
    const changed = buildCodexContextPayload({
      ...input,
      mountedContexts: [{ ...mountedContext, content: `${sheet.body}\n\n新增内容` }],
      syncedStableSignature: initial.stableSignature,
      includeRecentMessages: false,
    });

    expect(changed.reusedStableContext).toBe(false);
    expect(changed.context).toContain("新增内容");
  });

  it("keeps resumed turn context small for a long unchanged document", () => {
    const { project, sheet } = fixture();
    const longBody = `# 长文\n\n${"这是一段需要保留的正文。".repeat(2_000)}`;
    const longSheet = { ...sheet, body: longBody };
    const longProject = { ...project, sheets: [longSheet] };
    const mountedContexts = [
      {
        id: "document:sheet-1",
        type: "document" as const,
        projectId: "project-1",
        sheetId: "sheet-1",
        title: "第一篇",
        subtitle: "当前文稿",
        content: longBody,
      },
    ];
    const initial = buildCodexContextPayload({
      project: longProject,
      sheet: longSheet,
      selectedText: "",
      messages: [],
      mentionModes: ["current-sheet"],
      skills: [],
      mountedContexts,
      agentRuntime: { provider: "codex", model: "auto", reasoningEffort: "medium", quickMode: false },
      libraryPath: "/Users/example/LobyLibrary",
    });
    const resumed = buildCodexContextPayload({
      project: longProject,
      sheet: longSheet,
      selectedText: "",
      messages: [],
      mentionModes: ["current-sheet"],
      skills: [],
      mountedContexts,
      agentRuntime: { provider: "codex", model: "auto", reasoningEffort: "medium", quickMode: false },
      libraryPath: "/Users/example/LobyLibrary",
      syncedStableSignature: initial.stableSignature,
      includeRecentMessages: false,
    });

    expect(initial.context.length).toBeGreaterThan(20_000);
    expect(resumed.context.length).toBeLessThan(initial.context.length * 0.05);
  });
});

function fixture(): { project: WritingProject; sheet: WritingSheet } {
  const sheet: WritingSheet = {
    id: "sheet-1",
    title: "第一篇",
    groupId: "group-main",
    status: "构思",
    targetWords: 1000,
    summary: "当前稿件摘要",
    body: "# 开头\n\n唯一正文片段\n\n## 案例\n\n结尾",
    updatedAt: "2026-07-09",
  };
  return {
    sheet,
    project: {
      id: "project-1",
      title: "写作项目",
      description: "项目描述",
      status: "构思",
      targetPlatform: "公众号",
      targetWords: 3000,
      tags: [],
      groups: [{ id: "group-main", title: "正文" }],
      sheets: [sheet],
      updatedAt: "2026-07-09",
      writingBrief: {
        audience: "专业读者",
        thesis: "核心观点",
        tone: "克制",
        publishingNotes: "发布备注",
      },
    },
  };
}

function countOccurrences(value: string, needle: string): number {
  return value.split(needle).length - 1;
}
