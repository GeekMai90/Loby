import { describe, expect, it } from "vitest";
import { normalizeAgentProposal } from "@/features/assistant/model/agentProposals";

const context = {
  projectId: "project-1",
  projectTitle: "项目",
  sheetId: "sheet-1",
  sheetTitle: "正文",
  baseBody: "# 原文",
};

describe("normalizeAgentProposal", () => {
  it("keeps nested Markdown fences inside structured insertion payloads", () => {
    const result = normalizeAgentProposal(
      {
        requestId: "request-1",
        sequence: 1,
        emittedAtMs: 1,
        kind: "proposal",
        proposalKind: "documentAction",
        toolName: "propose_insert_text",
        payload: {
          title: "插入测试稿",
          summary: "测试 Markdown",
          text: "# 标题\n\n```js\nconsole.log(1)\n```",
          target: "cursor",
          anchor: null,
        },
      },
      context,
    );
    expect(result.action?.type).toBe("insertText");
    expect(result.action?.payload.text).toContain("```js");
  });

  it("creates a reviewable change set from a document proposal", () => {
    const result = normalizeAgentProposal(
      {
        requestId: "request-2",
        sequence: 1,
        emittedAtMs: 1,
        kind: "proposal",
        proposalKind: "documentChange",
        toolName: "propose_document_change",
        payload: { summary: "补充正文", proposedBody: "# 原文\n\n新增内容" },
      },
      context,
    );
    expect(result.changeSet?.baseBody).toBe("# 原文");
    expect(result.changeSet?.proposedBody).toContain("新增内容");
  });
});
