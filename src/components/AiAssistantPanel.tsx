import type { ProjectResourceFile, ProjectResourceText, WritingSheet } from "../types";
import type { ProjectResourcePaths } from "../lib/projectModel";
import type { useAiAssistant } from "../hooks/useAiAssistant";
import { AiPanel } from "./AiPanel";

interface AiAssistantPanelProps {
  assistant: ReturnType<typeof useAiAssistant>;
  projectSheets: WritingSheet[];
  resourcePaths: ProjectResourcePaths | null;
  projectResources: ProjectResourceFile[];
  selectedResourcePaths: string[];
  resourceImportStatus: string;
  resourcePreview: ProjectResourceText | null;
  resourcePreviewBusy: boolean;
  onSelectedResourcePathsChange: (paths: string[]) => void;
  onImportAssets: () => void;
  onImportReferences: () => void;
  onOpenResourcePath: (path: string, label: string) => void;
  onPreviewResource: (resource: ProjectResourceFile) => void;
  onClearResourcePreview: () => void;
}

export function AiAssistantPanel({
  assistant,
  projectSheets,
  resourcePaths,
  projectResources,
  selectedResourcePaths,
  resourceImportStatus,
  resourcePreview,
  resourcePreviewBusy,
  onSelectedResourcePathsChange,
  onImportAssets,
  onImportReferences,
  onOpenResourcePath,
  onPreviewResource,
  onClearResourcePreview,
}: AiAssistantPanelProps) {
  return (
    <AiPanel
      suggestion={assistant.suggestion}
      diffLines={assistant.diffLines}
      messages={assistant.messages}
      conversations={assistant.conversations}
      activeConversationId={assistant.activeConversationId}
      input={assistant.input}
      busy={assistant.busy}
      planMode={assistant.planMode}
      mentionModes={assistant.mentionModes}
      projectSheets={projectSheets}
      selectedContextSheetIds={assistant.selectedContextSheetIds}
      resourcePaths={resourcePaths}
      projectResources={projectResources}
      selectedResourcePaths={selectedResourcePaths}
      resourceImportStatus={resourceImportStatus}
      resourcePreview={resourcePreview}
      resourcePreviewBusy={resourcePreviewBusy}
      skills={assistant.skills}
      selectedSkillIds={assistant.selectedSkillIds}
      skillTaskStatus={assistant.skillTaskStatus}
      codexCliPath={assistant.codexCliPath}
      providerMode={assistant.providerMode}
      probe={assistant.probe}
      probeBusy={assistant.probeBusy}
      onSelectConversation={assistant.setActiveConversationId}
      onCreateConversation={assistant.createConversation}
      onForkConversation={assistant.forkConversation}
      onCompactConversation={assistant.compactConversation}
      onDeleteConversation={assistant.deleteConversation}
      onInputChange={assistant.setInput}
      onPlanModeChange={assistant.setPlanMode}
      onMentionModesChange={assistant.setMentionModes}
      onSelectedContextSheetIdsChange={assistant.setSelectedContextSheetIds}
      onSelectedResourcePathsChange={onSelectedResourcePathsChange}
      onImportAssets={onImportAssets}
      onImportReferences={onImportReferences}
      onOpenResourcePath={onOpenResourcePath}
      onPreviewResource={onPreviewResource}
      onClearResourcePreview={onClearResourcePreview}
      onSelectedSkillIdsChange={assistant.setSelectedSkillIds}
      onCreateSkillTasks={assistant.createLocalSkillTasks}
      onCodexCliPathChange={assistant.setCodexCliPath}
      onProviderModeChange={assistant.setProviderMode}
      onProbeCodex={assistant.runProbe}
      onSend={() => assistant.sendMessage()}
      onQuickStructure={() => assistant.sendMessage("请阅读当前稿件卡片，给出结构诊断和 3 条具体修改建议。")}
      onQuickPolish={() => assistant.sendMessage("请润色当前选区；如果没有选区，请给当前稿件卡片给出局部润色建议，不要直接整篇重写。")}
      onCodexInlineEdit={assistant.requestInlineEdit}
      onPolish={assistant.generatePolishSuggestion}
      onTitle={assistant.generateTitleSuggestion}
      onSummary={assistant.generateSummarySuggestion}
      onImageIdeas={assistant.generateImageIdeaSuggestion}
      onSaveNote={assistant.saveSuggestionAsMaterialSheet}
      onAccept={assistant.acceptSuggestion}
      onReject={assistant.rejectSuggestion}
    />
  );
}
