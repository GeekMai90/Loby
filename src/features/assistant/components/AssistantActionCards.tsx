/**
 * [INPUT]: 依赖 React 运行时、shared 公共契约、AI 助手模块
 * [OUTPUT]: 对外提供 AssistantActionCards
 * [POS]: AI 助手 feature 的界面组合单元，连接 AI 助手状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useContext } from "react";
import type { AiAction } from "@/shared/types";
import { AssistantActionCard } from "@/features/assistant/components/AssistantActionCard";
import { AssistantActionActionsContext, AssistantActionTargetContext } from "@/features/assistant/components/AssistantMessageContexts";

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
