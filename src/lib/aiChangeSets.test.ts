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
} from "./aiChangeSets";
import type { AiChangeBlock, AiChangeSet, WritingSheet } from "../types";

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

  it("builds fallback line changes when the payload omits explicit changes", () => {
    const baseBody = ["第一段", "第二段", "第三段"].join("\n");
    const proposedBody = ["第一段", "第二段改写", "第三段"].join("\n");
    const message = `说明\n\`\`\`loby-change\n${JSON.stringify({ proposedBody })}\n\`\`\``;

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
    type: "正文",
    status: "构思",
    targetWords: 1000,
    summary: "",
    body: "",
    updatedAt: "2026-07-09T10:00:00+08:00",
    ...overrides,
  };
}
