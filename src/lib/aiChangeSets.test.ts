import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyAcceptedChangesToBody,
  extractAiChangeSetFromMessage,
  findChangePosition,
  resolveChangeSetStatus,
  stripAiChangeBlock,
} from "./aiChangeSets";
import type { AiChangeBlock } from "../types";

describe("aiChangeSets", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-09T10:00:00+08:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("extracts a reviewable change set while keeping visible assistant text", () => {
    const baseBody = "但 Demon 不一样。";
    const message = [
      "我会把这句说得更具体。",
      "```nibva-change",
      JSON.stringify({
        summary: "润色 Demon 解释",
        proposedBody: "但 Demon 不一样。它更接近邪恶灵体。",
        changes: [
          {
            fromText: "但 Demon 不一样。",
            toText: "但 Demon 不一样。它更接近邪恶灵体。",
            reason: "补足概念解释。",
          },
        ],
      }),
      "```",
    ].join("\n");

    const result = extractAiChangeSetFromMessage(message, "sheet-1", baseBody);

    expect(result.content).toBe("我会把这句说得更具体。");
    expect(result.changeSet?.summary).toBe("润色 Demon 解释");
    expect(result.changeSet?.baseBody).toBe(baseBody);
    expect(result.changeSet?.proposedBody).toBe("但 Demon 不一样。它更接近邪恶灵体。");
    expect(result.changeSet?.changes).toMatchObject([
      {
        status: "pending",
        fromText: "但 Demon 不一样。",
        toText: "但 Demon 不一样。它更接近邪恶灵体。",
        reason: "补足概念解释。",
      },
    ]);
  });

  it("ignores malformed or no-op change blocks", () => {
    const baseBody = "正文";

    expect(extractAiChangeSetFromMessage("```nibva-change\nnot-json\n```", "sheet-1", baseBody).changeSet).toBeNull();
    expect(
      extractAiChangeSetFromMessage(`说明\n\`\`\`nibva-change\n${JSON.stringify({ proposedBody: baseBody })}\n\`\`\``, "sheet-1", baseBody)
        .changeSet,
    ).toBeNull();
  });

  it("builds fallback line changes when the payload omits explicit changes", () => {
    const baseBody = ["第一段", "第二段", "第三段"].join("\n");
    const proposedBody = ["第一段", "第二段改写", "第三段"].join("\n");
    const message = `说明\n\`\`\`nibva-change\n${JSON.stringify({ proposedBody })}\n\`\`\``;

    const result = extractAiChangeSetFromMessage(message, "sheet-1", baseBody);

    expect(result.changeSet?.changes).toHaveLength(1);
    expect(result.changeSet?.changes[0]).toMatchObject({
      fromText: "第二段",
      toText: "第二段改写",
      anchor: {
        before: "第一段",
        after: "第三段",
        startLine: 2,
        endLine: 2,
      },
    });
  });

  it("applies accepted changes and resolves aggregate status", () => {
    const changes: AiChangeBlock[] = [
      {
        id: "change-1",
        status: "accepted",
        fromText: "旧句子",
        toText: "新句子",
        reason: "",
        anchor: {},
      },
      {
        id: "change-2",
        status: "rejected",
        fromText: "保留",
        toText: "替换",
        reason: "",
        anchor: {},
      },
    ];

    expect(applyAcceptedChangesToBody("旧句子，保留。", changes)).toBe("新句子，保留。");
    expect(resolveChangeSetStatus(changes)).toBe("partiallyAccepted");
    expect(resolveChangeSetStatus(changes.map((change) => ({ ...change, status: "accepted" })))).toBe("accepted");
  });

  it("finds positions for accepted and pending changes", () => {
    const pending: AiChangeBlock = {
      id: "change-1",
      status: "pending",
      fromText: "原文",
      toText: "新文",
      reason: "",
      anchor: {},
    };
    const accepted = { ...pending, status: "accepted" as const };

    expect(findChangePosition("这里是原文。", pending)).toEqual({ from: 3, to: 5 });
    expect(findChangePosition("这里是新文。", accepted)).toEqual({ from: 3, to: 5 });
  });

  it("strips incomplete streamed change blocks from visible text", () => {
    expect(stripAiChangeBlock('先说明\n```nibva-change\n{"proposedBody"')).toBe("先说明");
  });
});
