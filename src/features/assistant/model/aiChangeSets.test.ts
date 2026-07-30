/**
 * [INPUT]: 依赖 Vitest、AI 正文变更模型与 shared 写作契约
 * [OUTPUT]: 验证正文变更解析、Myers 最小差异、历史错位修复、应用、审阅、回滚与守卫规则
 * [POS]: assistant model 的正文审阅回归边界，保护事实正文与可视差异始终一致
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  acceptAiChangeSet,
  AI_CHANGE_SET_MESSAGES,
  aiChangeSetPrimaryAction,
  applyAcceptedChangesToBody,
  changeSetIntroducesImageReference,
  extractAiChangeSetFromMessage,
  filterReviewPanelChangeSets,
  filterVisibleAiChangeSetIds,
  findChangePosition,
  positionAiReviewChanges,
  rejectAiChangeSet,
  resolveChangeSetStatus,
  shouldOpenAiChangeSetTarget,
  stripAiChangeBlock,
  validateAiChangeSetApply,
  validateAiChangeSetRollback,
} from "@/features/assistant/model/aiChangeSets";
import type { AiChangeBlock, AiChangeSet, WritingSheet } from "@/shared/types";

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
      "```loby-change",
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

    expect(extractAiChangeSetFromMessage("```loby-change\nnot-json\n```", "sheet-1", baseBody).changeSet).toBeNull();
    expect(
      extractAiChangeSetFromMessage(`说明\n\`\`\`loby-change\n${JSON.stringify({ proposedBody: baseBody })}\n\`\`\``, "sheet-1", baseBody)
        .changeSet,
    ).toBeNull();
  });

  it("builds minimal fallback text changes when the payload omits explicit changes", () => {
    const baseBody = ["第一段", "第二段", "第三段"].join("\n");
    const proposedBody = ["第一段", "第二段改写", "第三段"].join("\n");
    const message = `说明\n\`\`\`loby-change\n${JSON.stringify({ proposedBody })}\n\`\`\``;

    const result = extractAiChangeSetFromMessage(message, "sheet-1", baseBody);

    expect(result.changeSet?.changes).toHaveLength(1);
    expect(result.changeSet?.changes[0]).toMatchObject({
      fromText: "",
      toText: "改写",
      anchor: {
        startLine: 2,
        endLine: 2,
      },
    });
  });

  it("derives review changes from the two document versions when the model returns a descriptive change summary", () => {
    const baseBody = ["## 第一节", "", "- 提纲一", "- 提纲二", "", "## 第二节"].join("\n");
    const proposedBody = ["## 第一节", "", "第一段完整正文。", "", "第二段完整正文。", "", "## 第二节"].join("\n");
    const message = [
      "已完成扩写。",
      "```loby-change",
      JSON.stringify({
        proposedBody,
        changes: [
          {
            fromText: "- 提纲一\n- 提纲二",
            toText: "将两条提纲扩写为两段完整正文。",
            reason: "补全第一节。",
          },
        ],
      }),
      "```",
    ].join("\n");

    const changeSet = extractAiChangeSetFromMessage(message, "sheet-1", baseBody).changeSet!;

    expect(changeSet.changes.some((change) => change.toText === "将两条提纲扩写为两段完整正文。")).toBe(false);
    expect(changeSet.changes.filter((change) => change.toText).every((change) => proposedBody.includes(change.toText))).toBe(true);
    expect(changeSet.changes.filter((change) => change.fromText).every((change) => baseBody.includes(change.fromText))).toBe(true);
  });

  it("keeps multi-paragraph Chinese proofreading changes granular when no full line remains identical", () => {
    const { baseBody, proposedBody } = lightlyPolishedArticle();
    const message = [
      "已完成轻校对。",
      "```loby-change",
      JSON.stringify({
        proposedBody,
        changes: [{ fromText: "开发的已经", toText: "已经开发得", reason: "调整语序。" }],
      }),
      "```",
    ].join("\n");

    const changeSet = extractAiChangeSetFromMessage(message, "sheet-1", baseBody).changeSet!;
    const acceptedChanges = changeSet.changes.map((change) => ({ ...change, status: "accepted" as const }));
    const removedLength = changeSet.changes.reduce((length, change) => length + change.fromText.length, 0);
    const addedLength = changeSet.changes.reduce((length, change) => length + change.toText.length, 0);

    expect(applyAcceptedChangesToBody(baseBody, acceptedChanges)).toBe(proposedBody);
    expect(removedLength).toBeLessThan(baseBody.length / 3);
    expect(addedLength).toBeLessThan(proposedBody.length / 3);
    expect(changeSet.changes.every((change) => !change.fromText.includes("\n\n") && !change.toText.includes("\n\n"))).toBe(true);
    expect(
      changeSet.changes.every(
        (change) =>
          typeof change.anchor.baseFrom === "number" &&
          typeof change.anchor.baseTo === "number" &&
          typeof change.anchor.from === "number" &&
          typeof change.anchor.to === "number",
      ),
    ).toBe(true);
  });

  it("repairs persisted line-misaligned review blocks with the document diff", () => {
    const { baseBody, proposedBody, baseParagraphs, proposedParagraphs } = lightlyPolishedArticle();
    const changeSet = aiChangeSet({
      status: "accepted",
      baseBody,
      proposedBody,
      changes: [
        changeBlock({ status: "accepted", fromText: baseParagraphs[0], toText: "", anchor: { from: 6, to: 6 } }),
        changeBlock({
          status: "accepted",
          fromText: `${baseParagraphs[1]}\n\n${baseParagraphs[2]}`,
          toText: proposedParagraphs[0],
          anchor: {},
        }),
        changeBlock({ status: "accepted", fromText: "", toText: proposedParagraphs[1], anchor: {} }),
        changeBlock({ status: "accepted", fromText: "", toText: proposedParagraphs[2], anchor: {} }),
      ],
    });

    const repaired = positionAiReviewChanges(changeSet);
    const removedLength = repaired.reduce((length, change) => length + change.fromText.length, 0);

    expect(applyAcceptedChangesToBody(baseBody, repaired)).toBe(proposedBody);
    expect(removedLength).toBeLessThan(baseBody.length / 3);
    expect(repaired.every((change) => typeof change.anchor.from === "number" && typeof change.anchor.to === "number")).toBe(true);
  });

  it("positions explicit deletion-only changes in the applied body", () => {
    const baseBody = [
      "## 第一节",
      "第一节正文。",
      "",
      "- 第一节提纲一",
      "- 第一节提纲二",
      "",
      "## 第二节",
      "第二节正文。",
      "",
      "- 第二节提纲",
      "",
      "## 第三节",
    ].join("\n");
    const proposedBody = ["## 第一节", "第一节正文。", "", "## 第二节", "第二节正文。", "", "## 第三节"].join("\n");
    const message = [
      "已清理完成章节的提纲。",
      "```loby-change",
      JSON.stringify({
        proposedBody,
        changes: [
          { fromText: "- 第一节提纲一\n- 第一节提纲二", toText: "" },
          { fromText: "- 第二节提纲", toText: "" },
        ],
      }),
      "```",
    ].join("\n");

    const changeSet = extractAiChangeSetFromMessage(message, "sheet-1", baseBody).changeSet!;

    expect(changeSet.changes.map((change) => change.anchor.from)).toEqual([
      proposedBody.indexOf("## 第二节"),
      proposedBody.indexOf("## 第三节"),
    ]);
    expect(changeSet.changes.every((change) => change.anchor.from === change.anchor.to)).toBe(true);
  });

  it("repairs missing deletion anchors in persisted change sets", () => {
    const changeSet = aiChangeSet({
      baseBody: "正文。\n\n- 已完成的提纲\n\n## 下一节",
      proposedBody: "正文。\n\n## 下一节",
      changes: [changeBlock({ fromText: "- 已完成的提纲", toText: "", status: "accepted", anchor: {} })],
    });

    expect(positionAiReviewChanges(changeSet)[0].anchor).toMatchObject({
      from: changeSet.proposedBody.indexOf("## 下一节"),
      to: changeSet.proposedBody.indexOf("## 下一节"),
    });
  });

  it("repairs persisted descriptive change lists before showing an accepted document diff", () => {
    const baseBody = ["## 第一节", "", "- 提纲一", "- 提纲二", "", "## 第二节"].join("\n");
    const proposedBody = ["## 第一节", "", "第一段完整正文。", "", "第二段完整正文。", "", "## 第二节"].join("\n");
    const changeSet = aiChangeSet({
      status: "accepted",
      baseBody,
      proposedBody,
      changes: [
        changeBlock({
          status: "accepted",
          fromText: "- 提纲一\n- 提纲二",
          toText: "将两条提纲扩写为两段完整正文。",
        }),
      ],
    });

    const reviewChanges = positionAiReviewChanges(changeSet);

    expect(reviewChanges.some((change) => change.toText === "将两条提纲扩写为两段完整正文。")).toBe(false);
    expect(reviewChanges.filter((change) => change.toText).every((change) => proposedBody.includes(change.toText))).toBe(true);
    expect(reviewChanges.every((change) => change.status === "accepted")).toBe(true);
  });

  it("detects change sets that introduce new image references", () => {
    const baseBody = "# 草稿\n\n正文\n\n![旧图](../assets/images/old.png)";
    const proposedBody = "# 草稿\n\n正文\n\n![旧图改名](../assets/images/old.png)\n\n![新封面](../assets/images/cover.png)";
    const result = extractAiChangeSetFromMessage(
      `说明\n\`\`\`loby-change\n${JSON.stringify({ proposedBody })}\n\`\`\``,
      "sheet-1",
      baseBody,
    );

    expect(result.changeSet).not.toBeNull();
    expect(changeSetIntroducesImageReference(result.changeSet!)).toBe(true);

    const altOnly = extractAiChangeSetFromMessage(
      `说明\n\`\`\`loby-change\n${JSON.stringify({ proposedBody: "# 草稿\n\n正文\n\n![旧图改名](../assets/images/old.png)" })}\n\`\`\``,
      "sheet-1",
      baseBody,
    );

    expect(altOnly.changeSet).not.toBeNull();
    expect(changeSetIntroducesImageReference(altOnly.changeSet!)).toBe(false);
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

  it("accepts, rejects, and prunes whole change-set review state", () => {
    const changeSet = aiChangeSet({
      changes: [changeBlock({ id: "change-1", status: "pending" }), changeBlock({ id: "change-2", status: "rejected" })],
    });

    expect(acceptAiChangeSet(changeSet)).toMatchObject({
      status: "accepted",
      changes: [{ status: "accepted" }, { status: "accepted" }],
    });
    expect(rejectAiChangeSet(changeSet)).toMatchObject({
      status: "rejected",
      changes: [{ status: "rejected" }, { status: "rejected" }],
    });
    expect(filterVisibleAiChangeSetIds(["missing", "change-set-1"], [changeSet])).toEqual(["change-set-1"]);
  });

  it("keeps active sheet changes and unresolved errored changes visible in the review panel", () => {
    const active = aiChangeSet({ id: "active", sheetId: "sheet-1" });
    const offSheetError = aiChangeSet({ id: "off-sheet-error", sheetId: "sheet-2", error: AI_CHANGE_SET_MESSAGES.applyBodyChanged });
    const offSheetClean = aiChangeSet({ id: "off-sheet-clean", sheetId: "sheet-3" });
    const rejectedError = aiChangeSet({
      id: "rejected-error",
      sheetId: "sheet-4",
      status: "rejected",
      error: AI_CHANGE_SET_MESSAGES.applyBodyChanged,
    });

    expect(
      filterReviewPanelChangeSets([active, offSheetError, offSheetClean, rejectedError], "sheet-1").map((changeSet) => changeSet.id),
    ).toEqual(["active", "off-sheet-error"]);
  });

  it("guards rollback against missing sheets or user edits after AI applied", () => {
    const changeSet = aiChangeSet({ proposedBody: "AI 改完的正文" });

    expect(validateAiChangeSetRollback(undefined, changeSet)).toEqual({
      ok: false,
      message: AI_CHANGE_SET_MESSAGES.rollbackSheetMissing,
    });
    expect(validateAiChangeSetRollback(sheet({ id: "other-sheet", body: "AI 改完的正文" }), changeSet)).toEqual({
      ok: false,
      message: AI_CHANGE_SET_MESSAGES.rollbackSheetMissing,
    });
    expect(validateAiChangeSetRollback(sheet({ body: "用户继续写过" }), changeSet)).toEqual({
      ok: false,
      message: AI_CHANGE_SET_MESSAGES.rollbackBodyChanged,
    });
    expect(validateAiChangeSetRollback(sheet({ body: "AI 改完的正文" }), changeSet)).toEqual({ ok: true });
  });

  it("guards automatic apply against missing sheets or user edits during AI generation", () => {
    const changeSet = aiChangeSet({ baseBody: "发送 AI 时的正文", proposedBody: "AI 改完的正文" });

    expect(validateAiChangeSetApply(undefined, changeSet)).toEqual({
      ok: false,
      message: AI_CHANGE_SET_MESSAGES.applySheetMissing,
    });
    expect(validateAiChangeSetApply(sheet({ id: "other-sheet", body: "发送 AI 时的正文" }), changeSet)).toEqual({
      ok: false,
      message: AI_CHANGE_SET_MESSAGES.applySheetMissing,
    });
    expect(validateAiChangeSetApply(sheet({ body: "用户继续写过" }), changeSet)).toEqual({
      ok: false,
      message: AI_CHANGE_SET_MESSAGES.applyBodyChanged,
    });
    expect(validateAiChangeSetApply(sheet({ body: "发送 AI 时的正文" }), changeSet)).toEqual({ ok: true });
  });

  it("detects when an applied AI edit should return to its target sheet", () => {
    const changeSet = aiChangeSet({ sheetId: "sheet-2" });

    expect(shouldOpenAiChangeSetTarget(changeSet, "sheet-1")).toBe(true);
    expect(shouldOpenAiChangeSetTarget(changeSet, "sheet-2")).toBe(false);
  });

  it("uses dismiss instead of rollback for unapplied errored edit cards", () => {
    expect(aiChangeSetPrimaryAction(aiChangeSet())).toBe("rollback");
    expect(aiChangeSetPrimaryAction(aiChangeSet({ error: AI_CHANGE_SET_MESSAGES.applyBodyChanged }))).toBe("dismiss");
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
    expect(stripAiChangeBlock('先说明\n```loby-change\n{"proposedBody"')).toBe("先说明");
  });

  it("keeps Markdown code fences inside a legacy proposed body", () => {
    const proposedBody = "# 标题\n\n```js\nconsole.log('落笔')\n```";
    const message = `说明\n\`\`\`loby-change\n${JSON.stringify({ summary: "补充代码", proposedBody })}\n\`\`\``;
    const result = extractAiChangeSetFromMessage(message, "sheet-1", "# 标题");
    expect(result.content).toBe("说明");
    expect(result.changeSet?.proposedBody).toBe(proposedBody);
  });
});

function aiChangeSet(overrides: Partial<AiChangeSet> = {}): AiChangeSet {
  return {
    id: "change-set-1",
    sheetId: "sheet-1",
    status: "pending",
    createdAt: "2026-07-09T10:00:00+08:00",
    summary: "修改",
    baseBody: "旧正文",
    proposedBody: "新正文",
    changes: [changeBlock()],
    ...overrides,
  };
}

function changeBlock(overrides: Partial<AiChangeBlock> = {}): AiChangeBlock {
  return {
    id: "change-1",
    status: "pending",
    fromText: "旧",
    toText: "新",
    reason: "",
    anchor: {},
    ...overrides,
  };
}

function sheet(overrides: Partial<WritingSheet> = {}): WritingSheet {
  return {
    id: "sheet-1",
    title: "文稿",
    tags: [],
    targetWords: 1000,
    description: "",
    body: "",
    createdAt: "2026-07-09T10:00:00+08:00",
    updatedAt: "2026-07-09T10:00:00+08:00",
    properties: {},
    ...overrides,
  };
}

function lightlyPolishedArticle() {
  const baseParagraphs = [
    "第一段功能开发的已经差不多了，足够满足需求了，这不并简单。",
    "第二段今天看到B站的视频，使用Flutter开发Markdown编辑器。",
    "第三段现在使用AI开发应用，原来得开着钱求开发者。",
  ];
  const proposedParagraphs = [
    "第一段功能已经开发得差不多了，足够满足需求，这并不简单。",
    "第二段今天看到 B 站的视频，使用 Flutter 开发 Markdown 编辑器。",
    "第三段现在使用 AI 开发应用，原来得花着钱求开发者。",
  ];
  return {
    baseBody: ["# 开发日记", ...baseParagraphs.flatMap((paragraph, index) => (index === 0 ? [paragraph] : ["", paragraph]))].join("\n"),
    proposedBody: ["# 开发日记", ...proposedParagraphs.flatMap((paragraph) => ["", paragraph])].join("\n"),
    baseParagraphs,
    proposedParagraphs,
  };
}
