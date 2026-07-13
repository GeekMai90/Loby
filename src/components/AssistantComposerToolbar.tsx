import { SendHorizontal, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    <div className="flex min-h-8.5 items-center justify-between gap-2">
      <div className="inline-flex min-w-0 flex-auto items-center justify-end gap-1.5">
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
      <Button
        variant={busy ? "destructive" : "default"}
        size="icon"
        type={busy ? "button" : "submit"}
        title={busy ? "取消" : "发送"}
        disabled={!busy && !canSend}
        onClick={busy ? () => void onCancel() : undefined}
      >
        {busy ? <Square /> : <SendHorizontal />}
      </Button>
    </div>
  );
}
