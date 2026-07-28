/**
 * [INPUT]: 依赖 React、设置控件、AI Provider 模型目录/凭证状态、连接目录、AgentSettings、快捷提示与当前写作库 Skill 管理契约
 * [OUTPUT]: 对外提供 AI 设置主页、快捷提示/Skills 二级页导航，以及由已添加连接能力派生的默认选择
 * [POS]: settings feature 的 AI 设置页面协调器，只持有内部页面、带能力的连接目录和非敏感偏好，不接触凭证明文
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useCallback, useState } from "react";
import { getAssistantSendModeOptions } from "@/features/settings/constants/settingsDialog";
import type {
  AgentModel,
  AgentModelCatalog,
  AgentProvider,
  AgentReasoningEffort,
  AiQuickPrompt,
  AssistantSendMode,
  ImageGenerationProvider,
} from "@/shared/types";
import { SettingsRow, SettingsSection, SettingsSelect } from "@/features/settings/components/SettingsControls";
import { QuickPromptSettingsEntry, QuickPromptSettingsPage } from "@/features/settings/components/QuickPromptSettingsSection";
import { AiConnectionSettingsSection, type AiConnectionOption } from "@/features/settings/components/AiConnectionSettingsSection";
import { SkillSettingsEntry, SkillSettingsPage } from "@/features/settings/components/SkillSettingsSection";
import { loadAgentSettings, saveAgentSettings } from "@/features/assistant/model/agentSettings";
import { buildModelOptions, formatReasoningLevel, getReasoningLevels } from "@/features/assistant/model/assistantComposer";

interface AiSettingsPanelProps {
  libraryPath: string;
  assistantSendMode: AssistantSendMode;
  agentProvider: AgentProvider;
  providerBaseUrl: string;
  agentModel: AgentModel;
  agentReasoningEffort: AgentReasoningEffort;
  modelCatalog: AgentModelCatalog | null;
  quickPrompts: AiQuickPrompt[];
  quickPromptsReady: boolean;
  onAssistantSendModeChange: (mode: AssistantSendMode) => void;
  onAgentProviderChange: (provider: AgentProvider) => void;
  onProviderBaseUrlChange: (url: string) => void;
  onAgentModelChange: (model: AgentModel) => void;
  onAgentReasoningEffortChange: (effort: AgentReasoningEffort) => void;
  onAddQuickPrompt: (title: string, content: string) => void;
  onEditQuickPrompt: (promptId: string, title: string, content: string) => void;
  onDeleteQuickPrompt: (promptId: string) => void;
  onMoveQuickPrompt: (promptId: string, direction: -1 | 1) => void;
}

export function AiSettingsPanel({
  libraryPath,
  assistantSendMode,
  agentProvider,
  providerBaseUrl,
  agentModel,
  agentReasoningEffort,
  modelCatalog,
  quickPrompts,
  quickPromptsReady,
  onAssistantSendModeChange,
  onAgentProviderChange,
  onProviderBaseUrlChange,
  onAgentModelChange,
  onAgentReasoningEffortChange,
  onAddQuickPrompt,
  onEditQuickPrompt,
  onDeleteQuickPrompt,
  onMoveQuickPrompt,
}: AiSettingsPanelProps) {
  const [imageProvider, setImageProvider] = useState<ImageGenerationProvider>(() => loadAgentSettings().imageGenerationProvider);
  const [settingsPage, setSettingsPage] = useState<"main" | "quick-prompts" | "skills">("main");
  const [connectionOptions, setConnectionOptions] = useState<AiConnectionOption[]>([
    { value: agentProvider, label: "正在读取连接…", capabilities: [] },
  ]);
  const updateConnectionOptions = useCallback((connections: AiConnectionOption[]) => {
    setConnectionOptions(connections);
    const availableImageProviders = new Set(
      connections
        .filter((connection) => connection.capabilities.includes("imageGeneration") && isImageGenerationProvider(connection.value))
        .map((connection) => connection.value),
    );
    setImageProvider((current) => {
      if (current === "auto" || availableImageProviders.has(current)) return current;
      saveAgentSettings({ imageGenerationProvider: "auto" });
      return "auto";
    });
  }, []);
  const modelOptions = buildModelOptions(modelCatalog, agentModel);
  const reasoningOptions = getReasoningLevels(modelCatalog, agentModel, agentReasoningEffort).map((effort) => ({
    value: effort,
    label: formatReasoningLevel(effort),
  }));
  const selectedModel = modelCatalog?.models.find((model) => model.slug === agentModel);
  const imageConnections = connectionOptions.filter(
    (connection): connection is AiConnectionOption & { value: Exclude<ImageGenerationProvider, "auto"> } =>
      connection.capabilities.includes("imageGeneration") && isImageGenerationProvider(connection.value),
  );
  const imageProviderOptions: Array<{ value: ImageGenerationProvider; label: string }> = imageConnections.length
    ? [
        { value: "auto", label: "自动选择" },
        ...imageConnections.map((connection) => ({ value: connection.value, label: connection.label })),
      ]
    : [{ value: "auto", label: "暂无可用的生图连接" }];

  function changeModel(model: AgentModel) {
    onAgentModelChange(model);
    const defaultReasoningLevel = modelCatalog?.models.find((option) => option.slug === model)?.defaultReasoningLevel;
    if (defaultReasoningLevel) onAgentReasoningEffortChange(defaultReasoningLevel);
  }

  function changeImageProvider(provider: ImageGenerationProvider) {
    setImageProvider(provider);
    saveAgentSettings({ imageGenerationProvider: provider });
  }

  if (settingsPage === "quick-prompts") {
    return (
      <QuickPromptSettingsPage
        prompts={quickPrompts}
        ready={quickPromptsReady}
        onAdd={onAddQuickPrompt}
        onEdit={onEditQuickPrompt}
        onDelete={onDeleteQuickPrompt}
        onMove={onMoveQuickPrompt}
        onBack={() => setSettingsPage("main")}
      />
    );
  }

  if (settingsPage === "skills") {
    return <SkillSettingsPage libraryPath={libraryPath} onBack={() => setSettingsPage("main")} />;
  }

  return (
    <>
      <SettingsSection title="默认">
        <SettingsSelect
          label="连接"
          description="AI 助手默认使用的文本大模型服务。"
          value={agentProvider}
          options={connectionOptions}
          width="fit"
          contentWidth="default"
          contentAlign="end"
          onChange={onAgentProviderChange}
        />
        <SettingsSelect
          label="模型"
          description="可用模型由当前连接提供；切换连接后会同步更新。"
          value={agentModel}
          options={modelOptions}
          width="fit"
          contentWidth="default"
          contentAlign="end"
          disabled={!modelCatalog}
          onChange={changeModel}
        />
        {modelCatalog && reasoningOptions.length > 0 ? (
          <SettingsSelect
            label="思考"
            description="只显示当前连接与模型明确支持的思考强度。"
            value={agentReasoningEffort}
            options={reasoningOptions}
            width="fit"
            contentWidth="default"
            contentAlign="end"
            onChange={onAgentReasoningEffortChange}
          />
        ) : (
          <SettingsRow label="思考" description="只显示当前连接与模型明确支持的思考强度。">
            <span className="text-xs text-muted-foreground">
              {modelCatalog ? (selectedModel?.supportsReasoning ? "由当前模型自动控制" : "当前模型不支持") : "正在获取可用档位…"}
            </span>
          </SettingsRow>
        )}
        <SettingsSelect
          label="生图"
          description="只显示已添加且支持图片生成的连接；自动模式会优先复用当前连接。"
          value={imageProvider}
          options={imageProviderOptions}
          width="fit"
          contentWidth="default"
          contentAlign="end"
          disabled={imageConnections.length === 0}
          onChange={changeImageProvider}
        />
        <SettingsSelect
          label="发送"
          description="设置 AI 助手输入框的发送快捷键。"
          value={assistantSendMode}
          options={getAssistantSendModeOptions()}
          width="fit"
          contentWidth="default"
          contentAlign="end"
          onChange={onAssistantSendModeChange}
        />
      </SettingsSection>

      <QuickPromptSettingsEntry prompts={quickPrompts} ready={quickPromptsReady} onOpen={() => setSettingsPage("quick-prompts")} />

      <SkillSettingsEntry libraryPath={libraryPath} onOpen={() => setSettingsPage("skills")} />

      <AiConnectionSettingsSection
        agentProvider={agentProvider}
        providerBaseUrl={providerBaseUrl}
        onAgentProviderChange={onAgentProviderChange}
        onProviderBaseUrlChange={onProviderBaseUrlChange}
        onAvailableConnectionsChange={updateConnectionOptions}
      />
    </>
  );
}

function isImageGenerationProvider(provider: AgentProvider): provider is Exclude<ImageGenerationProvider, "auto"> {
  return provider === "chatgpt-subscription" || provider === "openai-api";
}
