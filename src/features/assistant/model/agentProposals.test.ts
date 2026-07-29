import { describe, expect, it } from "vitest";
import { normalizeAgentProposal, resolveAssistantProposals } from "@/features/assistant/model/agentProposals";

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

  it("removes duplicated proposal protocol fields while preserving the author-facing explanation", () => {
    const proposal = normalizeAgentProposal(
      {
        requestId: "request-3",
        sequence: 1,
        emittedAtMs: 1,
        kind: "proposal",
        proposalKind: "documentAction",
        toolName: "propose_insert_image",
        payload: {
          title: "插入小麦风格配图",
          summary: "在第 7 段之后插入配图",
          path: "../assets/images/example.png",
          alt: "信息垃圾与思考空间",
          target: "anchor",
          anchor: { type: "paragraphFromStart", index: 7, position: "after", text: "问题就出在这里" },
        },
      },
      context,
    );

    const result = resolveAssistantProposals({
      message: [
        "已创建图片插入确认卡片。",
        "",
        "建议放在第 7 段之后，用来强化信息垃圾与思考空间的对比。",
        "",
        "文稿动作：",
        "- 插入小麦风格配图｜pending｜target=anchor；title=插入小麦风格配图；path=../assets/images/example.png；alt=信息垃圾与思考空间｜锚点=第 7 段之后",
      ].join("\n"),
      structuredActions: proposal.action ? [proposal.action] : [],
      structuredChangeSet: null,
      context,
      activities: [],
    });

    expect(result.content).toBe("已创建图片插入确认卡片。\n\n建议放在第 7 段之后，用来强化信息垃圾与思考空间的对比。");
    expect(result.actions).toHaveLength(1);

    const echoOnly = resolveAssistantProposals({
      message: "文稿动作：\n- 插入小麦风格配图｜pending｜target=anchor；path=../assets/images/example.png；alt=信息垃圾与思考空间",
      structuredActions: proposal.action ? [proposal.action] : [],
      structuredChangeSet: null,
      context,
      activities: [],
    });
    expect(echoOnly.content).toBe("已创建图片插入确认卡片，请在下方确认。");
  });
});
