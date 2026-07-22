/**
 * [INPUT]: 依赖 shared 公共契约、AI 助手模块
 * [OUTPUT]: 对外提供 AiActionCardState、buildAiActionCardState
 * [POS]: AI 助手 feature 的领域模型边界，集中 AI 助手 规则、数据转换与外部契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { AiAction } from "@/shared/types";
import { type AiActionTargetContext, validateAiActionTarget } from "@/features/assistant/model/aiActionEffects";
import { canApplyAiAction, canRejectAiAction, canRevertAiAction } from "@/features/assistant/model/aiActionState";
import { validateAiActionPayload } from "@/features/assistant/model/aiActionValidation";

export interface AiActionCardState {
  canApply: boolean;
  canReject: boolean;
  canRevert: boolean;
  canExecute: boolean;
  applying: boolean;
  invalid: boolean;
  validationIssues: string[];
  targetWarning?: string;
  showValidationWarning: boolean;
  showTargetWarning: boolean;
}

export function buildAiActionCardState(action: AiAction, targetContext: AiActionTargetContext = {}): AiActionCardState {
  const canApply = canApplyAiAction(action.status);
  const canReject = canRejectAiAction(action.status);
  const canRevert = canRevertAiAction(action);
  const validation = validateAiActionPayload(action);
  const targetGuard = validateAiActionTarget(action, targetContext);
  const validationIssues = validation.issues;
  const hasValidationIssues = validationIssues.length > 0;
  const showValidationWarning = hasValidationIssues && action.status === "proposed";
  const showTargetWarning = !targetGuard.ok && canApply;

  return {
    canApply,
    canReject,
    canRevert,
    canExecute: canApply && !hasValidationIssues && targetGuard.ok,
    applying: action.status === "applying",
    invalid: showValidationWarning || showTargetWarning,
    validationIssues,
    targetWarning: targetGuard.ok ? undefined : targetGuard.message,
    showValidationWarning,
    showTargetWarning,
  };
}
