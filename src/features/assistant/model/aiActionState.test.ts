import { describe, expect, it } from "vitest";
import {
  aiActionApplyLabel,
  aiActionStatusLabel,
  canApplyAiAction,
  canRejectAiAction,
  canRevertAiAction,
} from "@/features/assistant/model/aiActionState";
import type { AiAction } from "@/shared/types";

describe("aiActionState", () => {
  it("allows failed actions to be retried or dismissed", () => {
    expect(canApplyAiAction("failed")).toBe(true);
    expect(canRejectAiAction("failed")).toBe(true);
    expect(aiActionApplyLabel("failed")).toBe("重试");
    expect(aiActionStatusLabel("failed")).toBe("失败");
  });

  it("locks completed actions", () => {
    expect(canApplyAiAction("applying")).toBe(false);
    expect(canRejectAiAction("applying")).toBe(false);
    expect(canApplyAiAction("applied")).toBe(false);
    expect(canRejectAiAction("applied")).toBe(false);
    expect(canApplyAiAction("rejected")).toBe(false);
    expect(canRejectAiAction("rejected")).toBe(false);
    expect(canApplyAiAction("reverted")).toBe(false);
    expect(canRejectAiAction("reverted")).toBe(false);
  });

  it("labels in-progress actions clearly", () => {
    expect(aiActionStatusLabel("applying")).toBe("执行中");
    expect(aiActionApplyLabel("applying")).toBe("执行中");
  });

  it("allows applied reversible actions to be reverted", () => {
    expect(
      canRevertAiAction(
        action({ status: "applied", effect: { type: "sheetVersionRestore", sheetId: "sheet-1", sheetTitle: "草稿", versionId: "v1" } }),
      ),
    ).toBe(true);
    expect(
      canRevertAiAction(
        action({
          status: "applied",
          effect: {
            type: "createdSheet",
            projectId: "project-1",
            sheetId: "sheet-2",
            sheetTitle: "素材",
            description: "",
            body: "# 素材\n\n",
            targetWords: 500,
          },
        }),
      ),
    ).toBe(true);
    expect(
      canRevertAiAction(
        action({ status: "failed", effect: { type: "sheetVersionRestore", sheetId: "sheet-1", sheetTitle: "草稿", versionId: "v1" } }),
      ),
    ).toBe(false);
    expect(canRevertAiAction(action({ status: "applied" }))).toBe(false);
  });
});

function action(overrides: Partial<AiAction>): AiAction {
  return {
    id: "action-1",
    type: "insertText",
    status: "proposed",
    title: "动作",
    summary: "摘要",
    payload: {},
    createdAt: "2026-07-09T10:00:00+08:00",
    ...overrides,
  };
}
