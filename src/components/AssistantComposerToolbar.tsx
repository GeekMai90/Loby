import type { ReactNode } from "react";
import { ArrowUp, ImagePlus, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AssistantModelSettingsMenu } from "./AssistantModelSettingsMenu";
import type { AgentModel, AgentReasoningEffort } from "../types";
import { AssistantGridLoader } from "./AssistantGridLoader";

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
  attachmentIcon?: ReactNode;
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
  attachmentIcon,
}: AssistantComposerToolbarProps) {
  const cancellable = busy && Boolean(onCancel);
  const sendingSteer = busy && canSend;
  const cancelling = cancellable && !sendingSteer;
  return (
    <div data-slot="assistant-composer-toolbar" className="flex min-h-8 items-center justify-between gap-2">
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
          {attachmentIcon ?? <ImagePlus />}
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
        data-assistant-send-button
        variant="default"
        size="icon"
        className="rounded-full bg-foreground text-[var(--app-bg)] hover:bg-foreground/80"
        type={cancelling ? "button" : "submit"}
        title={busy ? (sendingSteer ? "发送引导" : cancellable ? "取消" : "处理中") : "发送"}
        disabled={busy ? !sendingSteer && !cancellable : !canSend}
        onClick={cancelling ? () => void onCancel?.() : undefined}
      >
        {busy ? (
          sendingSteer ? (
            <ArrowUp strokeWidth={2.4} />
          ) : cancellable ? (
            <Square />
          ) : (
            <AssistantGridLoader />
          )
        ) : (
          <ArrowUp strokeWidth={2.4} />
        )}
      </Button>
    </div>
  );
}
