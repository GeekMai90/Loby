import type { AiAction } from "../types";
import { type AiActionTargetContext, validateAiActionTarget } from "./aiActionEffects";
import { canApplyAiAction, canRejectAiAction, canRevertAiAction } from "./aiActionState";
import { validateAiActionPayload } from "./aiActionValidation";

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
