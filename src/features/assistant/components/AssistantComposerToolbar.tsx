/**
 * [INPUT]: 依赖 React 运行时、lucide-react、shadcn/ui 基础控件、AI 助手模块、shared 公共契约
 * [OUTPUT]: 对外提供 AssistantComposerToolbar
 * [POS]: AI 助手 feature 的界面组合单元，连接 AI 助手状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { ReactNode } from "react";
import { ArrowUp, ImagePlus, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AssistantModelSettingsMenu } from "@/features/assistant/components/AssistantModelSettingsMenu";
import type { AgentModel, AgentReasoningEffort } from "@/shared/types";
import { AssistantGridLoader } from "@/features/assistant/components/AssistantGridLoader";

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
