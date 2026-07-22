/**
 * [INPUT]: 依赖 shared 公共契约
 * [OUTPUT]: 对外提供 canApplyAiAction、canRejectAiAction、aiActionStatusLabel、aiActionApplyLabel、canRevertAiAction
 * [POS]: AI 助手 feature 的领域模型边界，集中 AI 助手 规则、数据转换与外部契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { AiAction, AiActionStatus } from "@/shared/types";

export function canApplyAiAction(status: AiActionStatus): boolean {
  return status === "proposed" || status === "failed";
}

export function canRejectAiAction(status: AiActionStatus): boolean {
  return status === "proposed" || status === "failed";
}

export function aiActionStatusLabel(status: AiActionStatus): string {
  if (status === "proposed") return "待确认";
  if (status === "applying") return "执行中";
  if (status === "applied") return "已执行";
  if (status === "rejected") return "已忽略";
  if (status === "reverted") return "已撤销";
  return "失败";
}

export function aiActionApplyLabel(status: AiActionStatus): string {
  if (status === "applying") return "执行中";
  return status === "failed" ? "重试" : "执行";
}

export function canRevertAiAction(action: AiAction): boolean {
  return action.status === "applied" && (action.effect?.type === "sheetVersionRestore" || action.effect?.type === "createdSheet");
}
