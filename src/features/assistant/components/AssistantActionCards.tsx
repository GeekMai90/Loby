/**
 * [INPUT]: 依赖 React 运行时、shared action 契约、单项成果展示、动作确认卡与消息目标上下文
 * [OUTPUT]: 对外提供 AssistantActionCards，按 action 顺序配对成果与确认/回执，并让批量图片共享一张决策卡
 * [POS]: AI 助手消息的动作组合层，确保普通成果不脱离各自决策、批量图片不拆成重复确认，不持有执行状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useContext } from "react";
import type { AiAction } from "@/shared/types";
import { AssistantActionArtifact } from "@/features/assistant/components/AssistantActionArtifacts";
import { AssistantActionCard } from "@/features/assistant/components/AssistantActionCard";
import { AssistantActionActionsContext, AssistantActionTargetContext } from "@/features/assistant/components/AssistantMessageContexts";

export function AssistantActionCards({ actions, messageContent }: { actions: AiAction[]; messageContent: string }) {
  const { onApplyAction, onRejectAction, onRevertAction, onOpenActionTarget } = useContext(AssistantActionActionsContext);
  const actionTargetContext = useContext(AssistantActionTargetContext);
  return (
    <div className="mt-2.5 grid min-w-0 gap-3" data-slot="assistant-action-confirmations">
      {actions.map((action) => (
        <div key={action.id} className="grid min-w-0 gap-1.5" data-action-item-id={action.id} data-slot="assistant-action-item">
          <AssistantActionArtifact action={action} messageContent={messageContent} />
          <AssistantActionCard
            action={action}
            targetContext={actionTargetContext}
            onApplyAction={onApplyAction}
            onRejectAction={onRejectAction}
            onRevertAction={onRevertAction}
            onOpenActionTarget={onOpenActionTarget}
          />
        </div>
      ))}
    </div>
  );
}
