/**
 * [INPUT]: 依赖 assistant-ui turn anchor、lucide-react、shadcn/ui 基础控件、共享 AssistantComposer、AI 助手连接目录、shared 公共契约、发布模块
 * [OUTPUT]: 对外提供 WechatThemeAssistantMessage、WechatThemeAssistantPanel，并复用主助手的 top-anchor 消息定位
 * [POS]: 发布 feature 的领域外壳，只声明主题助手的空状态和结果边界；通用消息滚动、附件输入生命周期完全复用主助手
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { createContext, useContext, useMemo } from "react";
import {
  AssistantRuntimeProvider,
  MessagePrimitive,
  ThreadPrimitive,
  useExternalStoreRuntime,
  useMessage,
  type ThreadMessageLike,
} from "@assistant-ui/react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AgentConnectionDirectoryItem } from "@/features/assistant/model/agentConnectionDirectory";
import type {
  AgentConversationSelection,
  AgentProvider,
  AgentModel,
  AgentReasoningEffort,
  AiAttachment,
  AssistantSendMode,
} from "@/shared/types";
import type { WechatThemeConversation, WechatThemeConversationMessage } from "@/features/publishing/model/wechatThemeStore";
import { AssistantComposer } from "@/features/assistant/components/AssistantComposer";
import {
  ASSISTANT_PROMPT_ACTION_CLASS_NAME,
  AssistantPromptEmptyState,
  AssistantThreadViewport,
} from "@/features/assistant/components/AssistantPanelChrome";
import { AssistantStaticMessage } from "@/features/assistant/components/AssistantMessageSurface";
import { AiPanelHeader } from "@/features/assistant/components/AiPanelHeader";

export type WechatThemeAssistantMessage = WechatThemeConversationMessage;

interface WechatThemeAssistantPanelProps {
  messages: WechatThemeAssistantMessage[];
  conversations: WechatThemeConversation[];
  activeConversationId: string;
  busy: boolean;
  connections: AgentConnectionDirectoryItem[];
  connectionsLoading?: boolean;
  agentProvider: AgentProvider;
  agentModel: AgentModel;
  agentReasoningEffort: AgentReasoningEffort;
  assistantSendMode: AssistantSendMode;
  onAgentSelectionChange: (selection: AgentConversationSelection) => void;
  onSend: (prompt: string, attachments: AiAttachment[]) => void;
  onCancel?: () => Promise<void> | void;
  onSteerText: (text: string) => Promise<void> | void;
  onSelectConversation: (conversationId: string) => void;
  onCreateConversation: () => void;
  onDeleteConversation: () => void;
  onRenameConversation: (conversationId: string, title: string) => void;
}

const SUGGESTIONS = ["整体更简洁一点", "标题更有层次感", "换成温暖的配色", "弱化引用框的存在感"];

const WechatThemeMessageMapContext = createContext<ReadonlyMap<string, WechatThemeAssistantMessage>>(new Map());

function WechatThemeMessage() {
  const messages = useContext(WechatThemeMessageMapContext);
  const messageId = useMessage((message) => message.id);
  const message = messages.get(messageId);
  if (!message) return null;
  return (
    <MessagePrimitive.Root>
      <AssistantStaticMessage
        role={message.role}
        content={message.content}
        attachments={message.attachments}
        run={message.run}
        error={message.error}
      />
    </MessagePrimitive.Root>
  );
}

export function WechatThemeAssistantPanel({
  messages,
  conversations,
  activeConversationId,
  busy,
  connections,
  connectionsLoading,
  agentProvider,
  agentModel,
  agentReasoningEffort,
  assistantSendMode,
  onAgentSelectionChange,
  onSend,
  onCancel,
  onSteerText,
  onSelectConversation,
  onCreateConversation,
  onDeleteConversation,
  onRenameConversation,
}: WechatThemeAssistantPanelProps) {
  const hasRunningMessage = messages.some((message) => message.run?.status === "running");
  const messageMap = useMemo(() => new Map(messages.map((message) => [message.id, message] as const)), [messages]);
  const runtime = useExternalStoreRuntime<WechatThemeAssistantMessage>({
    messages,
    isRunning: busy,
    isSendDisabled: false,
    convertMessage: (message): ThreadMessageLike => ({
      id: message.id,
      role: message.role,
      content: message.content,
      status:
        message.role === "assistant"
          ? message.run?.status === "running"
            ? { type: "running" }
            : { type: "complete", reason: "stop" }
          : undefined,
    }),
    onNew: async () => {},
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <aside
        data-slot="wechat-theme-assistant-panel"
        className="relative flex min-h-0 min-w-0 flex-col overflow-hidden border-l border-border bg-background text-sm [--assistant-panel-gutter:10px]"
      >
        <AiPanelHeader
          messages={messages}
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={onSelectConversation}
          onCreateConversation={onCreateConversation}
          onDeleteConversation={onDeleteConversation}
          onRenameConversation={onRenameConversation}
          conversationActionsDisabled={busy}
        />
        <ThreadPrimitive.Root className="flex min-h-0 flex-auto flex-col gap-2.5">
          <WechatThemeMessageMapContext.Provider value={messageMap}>
            <AssistantThreadViewport asChild className="px-[var(--assistant-panel-gutter)]">
              <ThreadPrimitive.Viewport turnAnchor="top">
                {messages.length === 0 ? (
                  <AssistantPromptEmptyState
                    title="✨ 直接描述你想要的样子"
                    description="AI 会直接修改当前主题，中间预览会实时更新。所有有效修改都会自动保存并可撤销。"
                  >
                    <div className="mt-4 grid gap-0">
                      {SUGGESTIONS.map((suggestion) => (
                        <Button
                          key={suggestion}
                          type="button"
                          variant="ghost"
                          className={ASSISTANT_PROMPT_ACTION_CLASS_NAME}
                          onClick={() => onSend(suggestion, [])}
                        >
                          <Sparkles />
                          {suggestion}
                        </Button>
                      ))}
                    </div>
                  </AssistantPromptEmptyState>
                ) : (
                  <ThreadPrimitive.Messages components={{ Message: WechatThemeMessage }} />
                )}
                {busy && !hasRunningMessage ? <AssistantStaticMessage role="assistant" content="" pending /> : null}
              </ThreadPrimitive.Viewport>
            </AssistantThreadViewport>
          </WechatThemeMessageMapContext.Provider>

          <AssistantComposer
            busy={busy}
            mountedContexts={[]}
            skills={[]}
            quickPrompts={[]}
            documents={[]}
            connections={connections}
            connectionsLoading={connectionsLoading}
            agentProvider={agentProvider}
            agentModel={agentModel}
            agentReasoningEffort={agentReasoningEffort}
            assistantSendMode={assistantSendMode}
            placeholder="例如：主色换成墨绿色，标题更克制"
            onDetachMountedContext={() => undefined}
            onAttachDocument={() => undefined}
            onAgentSelectionChange={onAgentSelectionChange}
            onCancel={onCancel}
            onSendText={(_text, _skillIds, attachments = []) => onSend(_text, attachments)}
            onSteerText={onSteerText}
          />
        </ThreadPrimitive.Root>
      </aside>
    </AssistantRuntimeProvider>
  );
}
