/**
 * [INPUT]: 依赖已配置连接目录、当前对话模型选择、AgentBrandIcon、shadcn dropdown primitives 与模型能力格式化规则
 * [OUTPUT]: 对外提供 AssistantModelSettingsMenu，以连接二级模型菜单和模型相关推理强度切换当前对话选择
 * [POS]: AI 助手 composer 的临时模型选择器；只调用会话级变更，不持有或写入设置默认值
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AgentProviderIcon } from "@/features/assistant/components/AgentBrandIcon";
import type { AgentConnectionDirectoryItem } from "@/features/assistant/model/agentConnectionDirectory";
import { formatCompactModelLabel, formatReasoningLevel, resolveModelCatalogSelection } from "@/features/assistant/model/assistantComposer";
import type { AgentConversationSelection, AgentProvider } from "@/shared/types";
import { Check, ChevronDown } from "lucide-react";

interface AssistantModelSettingsMenuProps {
  connections: AgentConnectionDirectoryItem[];
  connectionsLoading?: boolean;
  agentProvider: AgentProvider;
  agentModel: string;
  agentReasoningEffort: string;
  showProviderIcon?: boolean;
  onSelectionChange: (selection: AgentConversationSelection) => void;
}

export function AssistantModelSettingsMenu({
  connections,
  connectionsLoading = false,
  agentProvider,
  agentModel,
  agentReasoningEffort,
  showProviderIcon = true,
  onSelectionChange,
}: AssistantModelSettingsMenuProps) {
  const selectedConnection = connections.find((connection) => connection.provider === agentProvider);
  const selectedModel = selectedConnection?.modelCatalog?.models.find((model) => model.slug === agentModel);
  const selectedModelLabel = selectedModel?.displayName || agentModel || "模型";
  const reasoningLevels = selectedModel?.supportsReasoning ? selectedModel.supportedReasoningLevels : [];
  const selectedReasoning = reasoningLevels.find((level) => level.effort === agentReasoningEffort);
  const reasoningLabel = selectedReasoning ? formatReasoningLevel(selectedReasoning.effort) : "";
  const triggerTitle = [selectedConnection?.label, selectedModelLabel, reasoningLabel].filter(Boolean).join(" · ");

  function selectModel(connection: AgentConnectionDirectoryItem, model: string) {
    if (!connection.modelCatalog) return;
    const selection = resolveModelCatalogSelection(connection.modelCatalog, model, agentReasoningEffort);
    onSelectionChange({ provider: connection.provider, ...selection });
  }

  return (
    <div className="inline-flex min-w-0">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="max-w-52 gap-1 px-1 text-caption font-normal hover:bg-transparent focus-visible:border-transparent focus-visible:ring-0 aria-expanded:bg-transparent"
            title={triggerTitle}
          >
            {showProviderIcon ? <AgentProviderIcon provider={agentProvider} className="text-[14px]" /> : null}
            <span className="truncate">{formatCompactModelLabel(agentProvider, selectedModelLabel)}</span>
            {reasoningLabel ? <span className="shrink-0 text-muted-foreground/65">{reasoningLabel}</span> : null}
            <ChevronDown className="text-muted-foreground/65" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="end" className="w-58">
          {connectionsLoading ? <DropdownMenuItem disabled>正在读取连接…</DropdownMenuItem> : null}
          {!connectionsLoading && connections.length === 0 ? <DropdownMenuItem disabled>尚未添加连接</DropdownMenuItem> : null}
          {connections.map((connection) => {
            const catalog = connection.modelCatalog;
            const selected = connection.provider === agentProvider;
            return (
              <DropdownMenuSub key={connection.provider}>
                <DropdownMenuSubTrigger disabled={!catalog || catalog.models.length === 0}>
                  <AgentProviderIcon provider={connection.provider} className="text-[15px]" />
                  <span className="min-w-0 flex-1 truncate">{connection.label}</span>
                  {selected ? <Check /> : null}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-58">
                  <DropdownMenuRadioGroup value={selected ? agentModel : ""} onValueChange={(model) => selectModel(connection, model)}>
                    {catalog?.models.map((model) => (
                      <DropdownMenuRadioItem key={model.slug} value={model.slug}>
                        <span className="truncate">{model.displayName || model.slug}</span>
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            );
          })}

          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger disabled={reasoningLevels.length === 0}>
              <span className="min-w-0 flex-1">推理强度</span>
              <span className="text-muted-foreground">{reasoningLabel || "不支持"}</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-42">
              <DropdownMenuRadioGroup
                value={agentReasoningEffort}
                onValueChange={(reasoningEffort) => onSelectionChange({ provider: agentProvider, model: agentModel, reasoningEffort })}
              >
                {reasoningLevels.map((level) => (
                  <DropdownMenuRadioItem key={level.effort} value={level.effort}>
                    <span>{formatReasoningLevel(level.effort)}</span>
                    {level.effort === selectedModel?.defaultReasoningLevel ? (
                      <span className="ml-auto text-muted-foreground">默认</span>
                    ) : null}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
