/**
 * [INPUT]: 依赖 Vitest、assistantMessageStyles 与 shared AgentRunInfo 契约
 * [OUTPUT]: 验证运行失败不使用系统卡片，并抑制与运行详情重复的错误正文
 * [POS]: assistant/model 的消息视觉语义回归测试，保护透明运行表面与展开竖线的信息所有权
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { describe, expect, it } from "vitest";
import {
  assistantMessageRootClassName,
  isAgentRunErrorEcho,
  resolveAssistantMessageSurfaceRole,
} from "@/features/assistant/model/assistantMessageStyles";
import type { AgentRunInfo } from "@/shared/types";

const failedRun: AgentRunInfo = {
  schemaVersion: 2,
  status: "error",
  phase: "failed",
  activities: [],
  usage: null,
  error: "DeepSeek 无法接受当前请求（HTTP 402）：Insufficient Balance",
};

describe("assistant message run surfaces", () => {
  it("projects a failed system record onto the transparent assistant surface", () => {
    const surfaceRole = resolveAssistantMessageSurfaceRole("system", failedRun);

    expect(surfaceRole).toBe("assistant");
    expect(assistantMessageRootClassName(surfaceRole)).toContain("bg-transparent");
    expect(assistantMessageRootClassName(surfaceRole)).not.toContain("bg-muted/40");
  });

  it("keeps ordinary system notices on the transparent timeline surface", () => {
    expect(resolveAssistantMessageSurfaceRole("system", undefined)).toBe("system");
    expect(assistantMessageRootClassName("system")).toContain("bg-transparent");
    expect(assistantMessageRootClassName("system")).not.toContain("bg-muted/40");
  });

  it("hides only the message body that repeats the expandable run error", () => {
    expect(isAgentRunErrorEcho(failedRun.error ?? "", failedRun)).toBe(true);
    expect(isAgentRunErrorEcho("已完成部分分析，随后连接中断。", failedRun)).toBe(false);
  });
});
