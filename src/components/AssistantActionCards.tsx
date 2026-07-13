import { useContext } from "react";
import type { AiAction } from "../types";
import { AssistantActionCard } from "./AssistantActionCard";
import { AssistantActionActionsContext, AssistantActionTargetContext } from "./AssistantMessageContexts";

export function AssistantActionCards({ actions }: { actions: AiAction[] }) {
  const { onApplyAction, onRejectAction, onRevertAction, onOpenActionTarget } = useContext(AssistantActionActionsContext);
  const actionTargetContext = useContext(AssistantActionTargetContext);
  return (
    <div className="mt-2.5 grid min-w-0 gap-2">
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
