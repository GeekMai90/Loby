/**
 * [INPUT]: 依赖 Tauri API、shared Agent/credential/MCP 公共契约
 * [OUTPUT]: 对外提供 Provider/Skill/MCP、凭证与真实连接验证、低预算会话标题请求、runtime 预热，以及带启动确认/checkpoint 替换、用户明确本地目录只读范围、sequence、run phase、typed activity 和终态封口的请求级 stream、取消和审批
 * [POS]: AI 助手 feature 的原生 IPC 边界，按 requestId 隔离并发事件，终态后丢弃已排队回调且不解释展示文案
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type {
  AgentCredentialStatus,
  AgentConversationMessage,
  AgentActivityKind,
  AgentActivityState,
  AgentActivityVisibility,
  AgentModelCatalog,
  AgentProvider,
  AgentRunPhase,
  AgentRunCheckpoint,
  AgentRuntimeSettings,
  AgentSkill,
  AgentSkillDraft,
  AgentSkillImportPreview,
  AgentUsage,
  ChatGptConnection,
  ChatGptDeviceAuthorization,
  McpServerConfig,
  McpToolInfo,
  ProjectResourceFile,
  ProjectResourceText,
  WritingProject,
} from "@/shared/types";
import type { AgentRunMetric } from "@/features/assistant/model/agentRunTimings";
import { extractExplicitLocalDirectoryPaths } from "@/features/assistant/model/localReferencePaths";

export interface AgentChatStreamEvent extends AgentRunMetric {
  requestId: string;
  sequence: number;
  emittedAtMs: number;
  kind:
    | "started"
    | "state"
    | "delta"
    | "message"
    | "status"
    | "activity"
    | "approval"
    | "proposal"
    | "usage"
    | "metric"
    | "done"
    | "error"
    | "cancelled";
  text?: string;
  error?: string;
  rawType?: string;
  itemId?: string;
  itemType?: string;
  activityKind?: AgentActivityKind;
  activityState?: Exclude<AgentActivityState, "unknown">;
  visibility?: AgentActivityVisibility;
  runPhase?: Exclude<AgentRunPhase, "preparingContext">;
  activeItemId?: string;
  parentId?: string;
  phase?: string;
  status?: string;
  title?: string;
  command?: string;
  output?: string;
  artifactPath?: string;
  proposalKind?: "documentAction" | "documentChange";
  toolName?: string;
  payload?: Record<string, unknown>;
  exitCode?: number | null;
  usage?: AgentUsage;
}

const AGENT_STREAM_EVENT_PREFIX = "loby://agent-chat-stream/";
const activeRuntimeWarmups = new Map<AgentProvider, Promise<void>>();

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function listAgentSkills(libraryPath: string): Promise<AgentSkill[]> {
  if (!isTauriRuntime()) return [];
  return invoke<AgentSkill[]>("list_agent_skills", { libraryPath: libraryPath || null });
}

export async function loadAgentSkillInstructions(libraryPath: string, skills: AgentSkill[]): Promise<AgentSkill[]> {
  if (!isTauriRuntime() || skills.length === 0) return skills;
  const instructions = await invoke<Array<{ path: string; instructions: string; truncated: boolean }>>("read_agent_skill_instructions", {
    libraryPath: libraryPath || null,
    paths: skills.map((skill) => skill.path),
  });
  const byPath = new Map(instructions.map((item) => [item.path, item]));
  return skills.map((skill) => {
    const loaded = byPath.get(skill.path);
    return loaded ? { ...skill, instructions: loaded.instructions, instructionsTruncated: loaded.truncated } : skill;
  });
}

export async function inspectAgentSkillImport(sourcePath: string): Promise<AgentSkillImportPreview> {
  if (!isTauriRuntime()) throw new Error("浏览器开发模式不能导入 Skill。");
  return invoke<AgentSkillImportPreview>("inspect_agent_skill_import", { sourcePath });
}

export async function installAgentSkill(libraryPath: string, sourcePath: string): Promise<AgentSkill> {
  return invoke<AgentSkill>("install_agent_skill", { libraryPath, sourcePath });
}

export async function createAgentSkill(libraryPath: string, draft: AgentSkillDraft): Promise<AgentSkill> {
  return invoke<AgentSkill>("create_agent_skill", { libraryPath, draft });
}

export async function setAgentSkillEnabled(libraryPath: string, skillId: string, enabled: boolean): Promise<AgentSkill> {
  return invoke<AgentSkill>("set_agent_skill_enabled", { libraryPath, skillId, enabled });
}

export async function deleteAgentSkill(libraryPath: string, skillId: string): Promise<AgentSkill[]> {
  return invoke<AgentSkill[]>("delete_agent_skill", { libraryPath, skillId });
}

export async function ensureAgentSkillDirectory(libraryPath: string): Promise<string> {
  return invoke<string>("ensure_agent_skill_directory", { libraryPath });
}

export async function listAgentModels(provider: AgentProvider): Promise<AgentModelCatalog> {
  if (!isTauriRuntime()) {
    return {
      fetchedAt: "",
      currentModel: "auto",
      currentReasoningEffort: "medium",
      models: [
        {
          slug: "browser-fallback",
          displayName: "Browser fallback",
          description: "浏览器开发模式占位模型",
          contextWindowTokens: 64_000,
          supportsReasoning: true,
          defaultReasoningLevel: "medium",
          supportedReasoningLevels: ["low", "medium", "high"].map((effort) => ({ effort, description: effort })),
          additionalSpeedTiers: [],
          serviceTiers: [],
        },
      ],
    };
  }
  return invoke<AgentModelCatalog>("list_agent_models", { provider });
}

export async function getAgentCredentialStatus(provider: string): Promise<AgentCredentialStatus> {
  if (!isTauriRuntime()) return { provider, configured: false };
  return invoke<AgentCredentialStatus>("get_agent_credential_status", { provider });
}

export async function saveAgentCredential(provider: string, secret: string): Promise<void> {
  if (!isTauriRuntime()) throw new Error("浏览器开发模式不能保存 AI 凭证。");
  return invoke<void>("save_agent_credential", { provider, secret });
}

export async function deleteAgentCredential(provider: string): Promise<void> {
  if (!isTauriRuntime()) return;
  return invoke<void>("delete_agent_credential", { provider });
}

export async function validateAgentConnection(provider: AgentProvider, baseUrl?: string): Promise<string> {
  if (!isTauriRuntime()) throw new Error("浏览器开发模式不能验证 AI 连接。");
  return invoke<string>("validate_agent_connection", { provider, baseUrl: baseUrl || null });
}

export async function getChatGptConnection(): Promise<ChatGptConnection> {
  if (!isTauriRuntime()) return { connected: false, planType: "" };
  return invoke<ChatGptConnection>("get_chatgpt_connection");
}

export async function startChatGptDeviceFlow(): Promise<ChatGptDeviceAuthorization> {
  if (!isTauriRuntime()) throw new Error("浏览器开发模式不能连接 ChatGPT。");
  return invoke<ChatGptDeviceAuthorization>("start_chatgpt_device_flow");
}

export async function completeChatGptDeviceFlow(authorization: ChatGptDeviceAuthorization): Promise<ChatGptConnection> {
  return invoke<ChatGptConnection>("complete_chatgpt_device_flow", { flowId: authorization.flowId });
}

export async function cancelChatGptDeviceFlow(authorization: ChatGptDeviceAuthorization): Promise<void> {
  if (!isTauriRuntime()) return;
  return invoke<void>("cancel_chatgpt_device_flow", { flowId: authorization.flowId });
}

export async function disconnectChatGpt(): Promise<void> {
  if (!isTauriRuntime()) return;
  return invoke<void>("disconnect_chatgpt");
}

export async function listMcpServers(): Promise<McpServerConfig[]> {
  if (!isTauriRuntime()) return [];
  return invoke<McpServerConfig[]>("list_mcp_servers");
}

export async function saveMcpServer(config: McpServerConfig): Promise<McpServerConfig[]> {
  return invoke<McpServerConfig[]>("save_mcp_server", { config });
}

export async function deleteMcpServer(id: string): Promise<McpServerConfig[]> {
  return invoke<McpServerConfig[]>("delete_mcp_server", { id });
}

export async function listMcpTools(serverId: string): Promise<McpToolInfo[]> {
  return invoke<McpToolInfo[]>("list_mcp_tools", { serverId });
}

export async function listProjectResources(libraryPath: string, project: WritingProject): Promise<ProjectResourceFile[]> {
  if (!isTauriRuntime() || !libraryPath.startsWith("/")) return [];
  return invoke<ProjectResourceFile[]>("list_project_resources", {
    path: libraryPath,
    projectId: project.id,
    projectTitle: project.title,
  });
}

export async function readProjectResourceText(libraryPath: string, resourcePaths: string[]): Promise<ProjectResourceText[]> {
  if (!isTauriRuntime() || !libraryPath.startsWith("/") || resourcePaths.length === 0) return [];
  return invoke<ProjectResourceText[]>("read_project_resource_text", { path: libraryPath, resourcePaths });
}

export async function runAgentChat({
  libraryPath,
  provider,
  prompt,
  context,
  conversationMessages = [],
  attachmentPaths = [],
  runtime,
}: {
  libraryPath: string;
  provider: AgentProvider;
  prompt: string;
  context: string;
  conversationMessages?: AgentConversationMessage[];
  attachmentPaths?: string[];
  runtime?: AgentRuntimeSettings;
}): Promise<{ output: string; error: string; command: string }> {
  if (!isTauriRuntime()) {
    return { output: "浏览器开发模式不能连接 AI Provider。请使用 Tauri 桌面应用。", error: "", command: "browser-fallback" };
  }
  return invoke("run_agent_chat", {
    path: libraryPath,
    provider,
    prompt,
    context,
    conversationMessages,
    attachmentPaths,
    runtime: runtime ?? null,
  });
}

export async function generateConversationTitle({
  provider,
  prompt,
  conversationMessages = [],
  runtime,
}: {
  provider: AgentProvider;
  prompt: string;
  conversationMessages?: AgentConversationMessage[];
  runtime?: AgentRuntimeSettings;
}): Promise<string> {
  if (!isTauriRuntime()) return "";
  return invoke<string>("generate_conversation_title", {
    provider,
    prompt,
    conversationMessages,
    runtime: runtime ?? null,
  });
}

export function prewarmAgentRuntime(provider: AgentProvider): Promise<void> {
  if (!isTauriRuntime()) return Promise.resolve();
  const active = activeRuntimeWarmups.get(provider);
  if (active) return active;
  const warmup = invoke<void>("prewarm_agent_runtime", { provider });
  activeRuntimeWarmups.set(provider, warmup);
  warmup.finally(() => activeRuntimeWarmups.delete(provider));
  return warmup;
}

export async function streamAgentChat({
  libraryPath,
  provider,
  prompt,
  context,
  conversationMessages = [],
  conversationId = "",
  attachmentPaths = [],
  runtime,
  onDelta,
  onEvent,
  onMessage,
  onActivity,
  onProposal,
  onUsage,
  onMetric,
  onError,
  onCancelled,
  onDone,
  onRequestId,
  onStarted,
  supersedesRequestId,
}: {
  libraryPath: string;
  provider: AgentProvider;
  prompt: string;
  context: string;
  conversationMessages?: AgentConversationMessage[];
  conversationId?: string;
  attachmentPaths?: string[];
  runtime?: AgentRuntimeSettings;
  onDelta: (delta: string, event?: AgentChatStreamEvent) => void;
  onEvent?: (event: AgentChatStreamEvent) => void;
  onMessage?: (text: string, event: AgentChatStreamEvent) => void;
  onActivity?: (event: AgentChatStreamEvent) => void;
  onProposal?: (event: AgentChatStreamEvent) => void;
  onUsage?: (usage: AgentUsage) => void;
  onMetric?: (metric: AgentRunMetric) => void;
  onError?: (message: string) => void;
  onCancelled?: (message: string) => void;
  onDone?: () => void;
  onRequestId?: (requestId: string) => void;
  onStarted?: (requestId: string) => void;
  supersedesRequestId?: string;
}): Promise<void> {
  if (!isTauriRuntime()) {
    onDelta("浏览器开发模式不能连接 AI Provider。请使用 Tauri 桌面应用。");
    onDone?.();
    return;
  }
  const localDirectoryPaths = extractExplicitLocalDirectoryPaths(prompt, conversationMessages);
  await activeRuntimeWarmups.get(provider)?.catch(() => undefined);
  const requestId = `agent-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  onRequestId?.(requestId);
  return new Promise((resolve, reject) => {
    let finished = false;
    let unlisten: (() => void) | undefined;
    const finish = () => {
      if (finished) return;
      finished = true;
      unlisten?.();
      onDone?.();
      resolve();
    };
    listen<AgentChatStreamEvent>(`${AGENT_STREAM_EVENT_PREFIX}${requestId}`, ({ payload }) => {
      if (finished || payload.requestId !== requestId) return;
      onEvent?.(payload);
      if (payload.kind === "delta" && payload.text) return onDelta(payload.text, payload);
      if (payload.kind === "message") return onMessage?.(payload.text || "", payload);
      if (payload.kind === "activity" || payload.kind === "approval") return onActivity?.(payload);
      if (payload.kind === "proposal") return onProposal?.(payload);
      if (payload.kind === "usage") return payload.usage && onUsage?.(payload.usage);
      if (payload.kind === "metric") return onMetric?.(payload);
      if (payload.kind === "error") {
        onError?.(payload.error || payload.text || "AI Provider 返回了错误。");
        return finish();
      }
      if (payload.kind === "cancelled") {
        onCancelled?.(payload.text || "已取消本次请求。");
        return finish();
      }
      if (payload.kind === "done") finish();
    })
      .then((cleanup) => {
        unlisten = cleanup;
        return invoke<void>("start_agent_chat_stream", {
          requestId,
          path: libraryPath,
          provider,
          prompt,
          context,
          conversationMessages,
          conversationId,
          attachmentPaths,
          localDirectoryPaths,
          runtime: runtime ?? null,
          supersedesRequestId: supersedesRequestId || null,
        });
      })
      .then(() => {
        onStarted?.(requestId);
      })
      .catch((error) => {
        unlisten?.();
        reject(error);
      });
  });
}

export async function cancelAgentChatStream(requestId: string): Promise<void> {
  if (!isTauriRuntime() || !requestId) return;
  return invoke<void>("cancel_agent_chat_stream", { requestId });
}

export async function steerAgentChatStream(requestId: string, text: string): Promise<void> {
  if (!isTauriRuntime() || !requestId || !text.trim()) return;
  return invoke<void>("steer_agent_chat_stream", { requestId, text });
}

export async function respondAgentApproval(
  approvalId: string,
  decision: "accept" | "acceptForSession" | "decline" | "cancel",
): Promise<void> {
  if (!isTauriRuntime()) return;
  return invoke<void>("respond_agent_approval", { approvalId, decision });
}

export async function listAgentRunCheckpoints(libraryPath: string): Promise<AgentRunCheckpoint[]> {
  if (!isTauriRuntime() || !libraryPath.startsWith("/")) return [];
  return invoke<AgentRunCheckpoint[]>("list_agent_run_checkpoints", { path: libraryPath });
}

export async function dismissAgentRunCheckpoint(libraryPath: string, requestId: string): Promise<void> {
  if (!isTauriRuntime() || !libraryPath.startsWith("/")) return;
  return invoke<void>("dismiss_agent_run_checkpoint", { path: libraryPath, requestId });
}
