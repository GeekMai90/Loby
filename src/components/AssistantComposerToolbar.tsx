import clsx from "clsx";
import { SendHorizontal, Square } from "lucide-react";
import { AssistantModelSettingsMenu } from "./AssistantModelSettingsMenu";
import type { AgentModel, AgentReasoningEffort } from "../types";

interface AssistantComposerToolbarProps {
  busy: boolean;
  canSend: boolean;
  modelOptions: Array<{ value: string; label: string }>;
  reasoningOptions: Array<{ value: string; label: string }>;
  agentModel: AgentModel;
  agentReasoningEffort: AgentReasoningEffort;
  agentQuickMode: boolean;
  quickModeSupported: boolean;
  onModelChange: (model: AgentModel) => void;
  onReasoningEffortChange: (effort: AgentReasoningEffort) => void;
  onQuickModeChange: (enabled: boolean) => void;
  onCancel: () => Promise<void> | void;
}

export function AssistantComposerToolbar({
  busy,
  canSend,
  modelOptions,
  reasoningOptions,
  agentModel,
  agentReasoningEffort,
  agentQuickMode,
  quickModeSupported,
  onModelChange,
  onReasoningEffortChange,
  onQuickModeChange,
  onCancel,
}: AssistantComposerToolbarProps) {
  return (
    <div className="assistant-composer-toolbar">
      <div className="assistant-composer-tools">
        <AssistantModelSettingsMenu
          modelOptions={modelOptions}
          reasoningOptions={reasoningOptions}
          agentModel={agentModel}
          agentReasoningEffort={agentReasoningEffort}
          agentQuickMode={agentQuickMode}
          quickModeSupported={quickModeSupported}
          onModelChange={onModelChange}
          onReasoningEffortChange={onReasoningEffortChange}
          onQuickModeChange={onQuickModeChange}
        />
      </div>
      <button
        className={clsx("assistant-send-button", busy && "cancel")}
        type={busy ? "button" : "submit"}
        title={busy ? "取消" : "发送"}
        disabled={!busy && !canSend}
        onClick={busy ? () => void onCancel() : undefined}
      >
        {busy ? <Square size={14} /> : <SendHorizontal size={16} />}
      </button>
    </div>
  );
}
