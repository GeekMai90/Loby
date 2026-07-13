import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";

interface AssistantModelSettingsMenuProps {
  modelOptions: { value: string; label: string }[];
  reasoningOptions: { value: string; label: string }[];
  agentModel: string;
  agentReasoningEffort: string;
  agentQuickMode: boolean;
  quickModeSupported: boolean;
  onModelChange: (value: string) => void;
  onReasoningEffortChange: (value: string) => void;
  onQuickModeChange: (enabled: boolean) => void;
}

export function AssistantModelSettingsMenu({
  modelOptions,
  reasoningOptions,
  agentModel,
  agentReasoningEffort,
  agentQuickMode,
  quickModeSupported,
  onModelChange,
  onReasoningEffortChange,
  onQuickModeChange,
}: AssistantModelSettingsMenuProps) {
  const selectedModel = modelOptions.find((option) => option.value === agentModel) ??
    modelOptions[0] ?? { value: agentModel, label: agentModel };
  const selectedReasoning = reasoningOptions.find((option) => option.value === agentReasoningEffort) ??
    reasoningOptions[0] ?? { value: agentReasoningEffort, label: agentReasoningEffort };

  return (
    <div className="inline-flex min-w-0">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="max-w-45 gap-1 px-1 font-normal"
            title={`${selectedModel.label} · ${selectedReasoning.label}${agentQuickMode ? " · 快速" : ""}`}
          >
            <span className="truncate">{formatCompactModelLabel(selectedModel.label)}</span>
            <span className="truncate text-muted-foreground">{selectedReasoning.label}</span>
            <ChevronDown className="text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-46">
          <DropdownMenuLabel>推理</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={selectedReasoning.value} onValueChange={onReasoningEffortChange}>
            {reasoningOptions.map((option) => (
              <DropdownMenuRadioItem key={option.value} value={option.value}>
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>{selectedModel.label}</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-50">
              <DropdownMenuLabel>模型</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={selectedModel.value} onValueChange={onModelChange}>
                {modelOptions.map((option) => (
                  <DropdownMenuRadioItem key={option.value} value={option.value}>
                    {option.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger disabled={!quickModeSupported} title={quickModeSupported ? "速度" : "当前模型不支持快速模式"}>
              速度
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-36">
              <DropdownMenuLabel>速度</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={agentQuickMode ? "quick" : "standard"}
                onValueChange={(value) => onQuickModeChange(value === "quick")}
              >
                <DropdownMenuRadioItem value="standard">标准</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="quick">快速</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function formatCompactModelLabel(label: string) {
  const normalized = label.trim();
  if (!normalized) return "模型";
  return normalized
    .replace(/^gpt[-\s]?/i, "")
    .replace(/-/g, " ")
    .replace(/\bcodex\b/i, "Codex");
}
