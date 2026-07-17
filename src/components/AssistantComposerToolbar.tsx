import { ImagePlus, LoaderCircle, SendHorizontal, Square } from "lucide-react";
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
  onCancel?: () => Promise<void> | void;
  onAttachImages: () => void;
  attachmentDisabled: boolean;
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
  onAttachImages,
  attachmentDisabled,
}: AssistantComposerToolbarProps) {
  const cancellable = busy && Boolean(onCancel);
  return (
    <div className="flex min-h-8.5 items-center justify-between gap-2">
      <div className="inline-flex min-w-0 flex-auto items-center gap-1.5">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground"
          onClick={onAttachImages}
          disabled={attachmentDisabled}
          title="添加图片"
        >
          <ImagePlus />
        </Button>
        <div className="min-w-0 flex-1" />
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
        variant={cancellable ? "destructive" : "default"}
        size="icon"
        type={cancellable ? "button" : "submit"}
        title={busy ? (cancellable ? "取消" : "处理中") : "发送"}
        disabled={busy ? !cancellable : !canSend}
        onClick={cancellable ? () => void onCancel?.() : undefined}
      >
        {busy ? cancellable ? <Square /> : <LoaderCircle className="animate-spin" /> : <SendHorizontal />}
      </Button>
    </div>
  );
}
