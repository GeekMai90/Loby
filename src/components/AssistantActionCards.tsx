import { useContext } from "react";
import type { AiAction } from "../types";
import { AssistantActionCard } from "./AssistantActionCard";
import { AssistantActionActionsContext, AssistantActionTargetContext } from "./AssistantMessageContexts";

export function AssistantActionCards({ actions }: { actions: AiAction[] }) {
  const { onApplyAction, onRejectAction, onRevertAction, onOpenActionTarget } = useContext(AssistantActionActionsContext);
  const actionTargetContext = useContext(AssistantActionTargetContext);
  return (
    <div className="assistant-action-cards">
      {actions.map((action) => (
        <AssistantActionCard
          key={action.id}
          action={action}
          targetContext={actionTargetContext}
          onApplyAction={onApplyAction}
          onRejectAction={onRejectAction}
          onRevertAction={onRevertAction}
          onOpenActionTarget={onOpenActionTarget}
        />
      ))}
    </div>
  );
}
