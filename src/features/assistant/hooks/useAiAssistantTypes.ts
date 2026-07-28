/**
 * [INPUT]: 依赖 shared 的 Provider、会话、文稿、上下文预览与正文变更公共契约
 * [OUTPUT]: 对外提供 useAiAssistant 的输入参数和单次发送选项类型
 * [POS]: AI 助手主协调 hook 的静态契约边界，让运行编排文件只保留状态与行为
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type {
  AgentModel,
  AgentProvider,
  AgentReasoningEffort,
  AiChangeSet,
  AssistantSendMode,
  ChatContextPreview,
  ChatConversation,
  WritingProject,
  WritingSheet,
} from "@/shared/types";

export interface UseAiAssistantParams {
  persistenceReady: boolean;
  libraryPath: string;
  initialAgentProvider: AgentProvider;
  initialProviderBaseUrl: string;
  initialAgentModel: AgentModel;
  initialAgentReasoningEffort: AgentReasoningEffort;
  initialAgentQuickMode: boolean;
  initialAssistantSendMode: AssistantSendMode;
  projects: WritingProject[];
  activeProject: WritingProject | undefined;
  activeSheet: WritingSheet | undefined;
  selectedText: string;
  onOpenAiPanel: () => void;
  onCreateChangeSet: (changeSet: AiChangeSet) => AiChangeSet | void;
  loadedConversations: ChatConversation[] | null;
}

export interface SendMessageOptions {
  replaceMessageId?: string;
  contextPreviews?: ChatContextPreview[];
  conversationId?: string;
  recoveryRequestId?: string;
}
