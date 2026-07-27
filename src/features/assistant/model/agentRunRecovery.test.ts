/**
 * [INPUT]: 依赖 Vitest 与 Agent run recovery 投影
 * [OUTPUT]: 验证重启恢复卡片身份、阶段文案与副作用防重试提示
 * [POS]: AI 助手崩溃恢复的 renderer 回归测试，守住显式确认与不自动重放写工具边界
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { describe, expect, it } from "vitest";
import type { AgentRunCheckpoint } from "@/shared/types";
import { buildRecoveryPrompt, checkpointToApproval, recoveryRequestId } from "@/features/assistant/model/agentRunRecovery";

describe("agentRunRecovery", () => {
  it("restores a waiting approval as an explicit recovery decision", () => {
    const checkpoint = fixture("waitingForApproval");
    const approval = checkpointToApproval(checkpoint);
    expect(approval).toMatchObject({ id: "recover:agent-1", title: "恢复待审批任务", status: "pending" });
    expect(recoveryRequestId(approval.id)).toBe("agent-1");
    expect(buildRecoveryPrompt(checkpoint)).toContain("待审批工具此前尚未执行");
  });

  it("requires external-state inspection after a write tool may have started", () => {
    expect(buildRecoveryPrompt(fixture("executingTool"))).toContain("先检查目标状态，避免重复写入");
    expect(recoveryRequestId("native-approval")).toBeNull();
  });
});

function fixture(status: AgentRunCheckpoint["status"]): AgentRunCheckpoint {
  return {
    version: 1,
    requestId: "agent-1",
    conversationId: "chat-1",
    provider: "openai-api",
    prompt: "创建 Skill",
    status,
    toolName: "create_skill",
    reason: "任务中断",
    updatedAtMs: 1,
  };
}
