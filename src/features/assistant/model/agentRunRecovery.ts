/**
 * [INPUT]: 依赖 shared 持久化运行 checkpoint 与审批契约
 * [OUTPUT]: 对外提供恢复审批映射、稳定 ID 解析与显式重试提示构造
 * [POS]: AI 助手 model 层的崩溃恢复投影，确保 renderer 不把中断任务伪装成仍在运行的原生审批
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { AgentApprovalRequest, AgentRunCheckpoint } from "@/shared/types";

const RECOVERY_APPROVAL_PREFIX = "recover:";

export function checkpointToApproval(checkpoint: AgentRunCheckpoint): AgentApprovalRequest {
  return {
    id: `${RECOVERY_APPROVAL_PREFIX}${checkpoint.requestId}`,
    assistantMessageId: "",
    title: checkpoint.status === "waitingForApproval" ? "恢复待审批任务" : "检查并恢复未完成任务",
    command: checkpoint.toolName || checkpoint.provider,
    reason: checkpoint.reason,
    status: "pending",
  };
}

export function recoveryRequestId(approvalId: string): string | null {
  return approvalId.startsWith(RECOVERY_APPROVAL_PREFIX) ? approvalId.slice(RECOVERY_APPROVAL_PREFIX.length) : null;
}

export function buildRecoveryPrompt(checkpoint: AgentRunCheckpoint): string {
  return [
    "继续上次因应用关闭而中断的任务。不要假定任何写操作已经成功。",
    `原始要求：${checkpoint.prompt}`,
    `中断阶段：${checkpoint.reason}`,
    checkpoint.status === "executingTool"
      ? "在重新执行写操作前，先检查目标状态，避免重复写入。"
      : checkpoint.status === "waitingForApproval"
        ? "待审批工具此前尚未执行。"
        : "上次未进入已确认的写工具阶段，可以作为新一轮任务重试。",
  ].join("\n");
}
