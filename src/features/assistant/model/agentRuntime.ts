/**
 * [INPUT]: 依赖 Tauri API、shared Agent/credential/MCP 公共契约
 * [OUTPUT]: 对外提供 Provider/Skill/MCP 发现、凭证状态、runtime 预热、请求级 stream、取消/审批与阶段耗时事件
 * [POS]: AI 助手 feature 的原生 IPC 边界，按 requestId 隔离并发事件且不接触真实凭证
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type {
  AgentCredentialStatus,
  AgentModelCatalog,
  AgentProvider,
  AgentRuntimeSettings,
  AgentSkill,
  AgentUsage,
  McpServerConfig,
  McpToolInfo,
  ProjectResourceFile,
  ProjectResourceText,
  WritingProject,
} from "@/shared/types";
import type { AgentRunMetric } from "@/features/assistant/model/agentRunTimings";

interface AgentChatStreamEvent extends AgentRunMetric {
  requestId: string;
  kind: "started" | "delta" | "message" | "status" | "activity" | "approval" | "usage" | "metric" | "done" | "error" | "cancelled";
  text?: string;
  error?: string;
  rawType?: string;
  itemId?: string;
  itemType?: string;
  phase?: string;
  status?: string;
  title?: string;
  command?: string;
  output?: string;
  artifactPath?: string;
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
  attachmentPaths = [],
  runtime,
}: {
  libraryPath: string;
  provider: AgentProvider;
  prompt: string;
  context: string;
  attachmentPaths?: string[];
  runtime?: AgentRuntimeSettings;
}): Promise<{ output: string; error: string; command: string }> {
  if (!isTauriRuntime()) {
    return { output: "浏览器开发模式不能连接 AI Provider。请使用 Tauri 桌面应用。", error: "", command: "browser-fallback" };
  }
  return invoke("run_agent_chat", { path: libraryPath, provider, prompt, context, attachmentPaths, runtime: runtime ?? null });
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
  attachmentPaths = [],
  runtime,
  onDelta,
  onMessage,
  onStatus,
  onActivity,
  onUsage,
  onMetric,
  onError,
  onCancelled,
  onDone,
  onRequestId,
}: {
  libraryPath: string;
  provider: AgentProvider;
  prompt: string;
  context: string;
  attachmentPaths?: string[];
  runtime?: AgentRuntimeSettings;
  onDelta: (delta: string, event?: AgentChatStreamEvent) => void;
  onMessage?: (text: string, event: AgentChatStreamEvent) => void;
  onStatus?: (event: AgentChatStreamEvent) => void;
  onActivity?: (event: AgentChatStreamEvent) => void;
  onUsage?: (usage: AgentUsage) => void;
  onMetric?: (metric: AgentRunMetric) => void;
  onError?: (message: string) => void;
  onCancelled?: (message: string) => void;
  onDone?: () => void;
  onRequestId?: (requestId: string) => void;
}): Promise<void> {
  if (!isTauriRuntime()) {
    onDelta("浏览器开发模式不能连接 AI Provider。请使用 Tauri 桌面应用。");
    onDone?.();
    return;
  }
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
      if (payload.requestId !== requestId) return;
      if (payload.kind === "delta" && payload.text) return onDelta(payload.text, payload);
      if (payload.kind === "message") return onMessage?.(payload.text || "", payload);
      if (payload.kind === "status") return onStatus?.(payload);
      if (payload.kind === "activity" || payload.kind === "approval") return onActivity?.(payload);
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
          attachmentPaths,
          runtime: runtime ?? null,
        });
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
