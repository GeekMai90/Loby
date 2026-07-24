/**
 * [INPUT]: 依赖 Tauri API、shared 公共契约
 * [OUTPUT]: 对外提供 Codex 能力发现、runtime 预热、请求级 stream、取消/审批控制与阶段耗时事件
 * [POS]: AI 助手 feature 的领域模型边界，集中 AI 助手外部契约并按 requestId 隔离并发事件通道
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type {
  AgentProvider,
  AgentRuntimeSettings,
  AgentUsage,
  CodexModelCatalog,
  CodexProbeResult,
  CodexSkill,
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
const activeRuntimeWarmups = new Map<string, Promise<void>>();

function agentStreamEventName(requestId: string): string {
  return `${AGENT_STREAM_EVENT_PREFIX}${requestId}`;
}

function runtimeWarmupKey(provider: AgentProvider, cliPath?: string): string {
  return `${provider}:${cliPath?.trim() || ""}`;
}

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function listCodexSkills(): Promise<CodexSkill[]> {
  if (!isTauriRuntime()) {
    return [
      {
        id: "local-prototype",
        name: "local-prototype",
        description: "Browser fallback skill placeholder",
        path: "browser",
      },
    ];
  }

  return invoke<CodexSkill[]>("list_codex_skills");
}

export async function loadCodexSkillInstructions(skills: CodexSkill[]): Promise<CodexSkill[]> {
  if (!isTauriRuntime() || skills.length === 0) return skills;

  const instructions = await invoke<Array<{ path: string; instructions: string; truncated: boolean }>>("read_codex_skill_instructions", {
    paths: skills.map((skill) => skill.path),
  });
  const byPath = new Map(instructions.map((item) => [item.path, item]));
  return skills.map((skill) => {
    const loaded = byPath.get(skill.path);
    if (!loaded) return skill;
    return {
      ...skill,
      instructions: loaded.instructions,
      instructionsTruncated: loaded.truncated,
    };
  });
}

export async function listCodexModels(): Promise<CodexModelCatalog> {
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
          supportedReasoningLevels: [
            { effort: "low", description: "Fast responses with lighter reasoning" },
            { effort: "medium", description: "Balances speed and reasoning depth" },
            { effort: "high", description: "Greater reasoning depth" },
          ],
          additionalSpeedTiers: [],
          serviceTiers: [],
        },
      ],
    };
  }

  return invoke<CodexModelCatalog>("list_codex_models");
}

export async function listProjectResources(libraryPath: string, project: WritingProject): Promise<ProjectResourceFile[]> {
  if (!isTauriRuntime() || !libraryPath.startsWith("/")) {
    return [];
  }

  return invoke<ProjectResourceFile[]>("list_project_resources", {
    path: libraryPath,
    projectId: project.id,
    projectTitle: project.title,
  });
}

export async function readProjectResourceText(libraryPath: string, resourcePaths: string[]): Promise<ProjectResourceText[]> {
  if (!isTauriRuntime() || !libraryPath.startsWith("/") || resourcePaths.length === 0) {
    return [];
  }

  return invoke<ProjectResourceText[]>("read_project_resource_text", {
    path: libraryPath,
    resourcePaths,
  });
}

export async function runAgentChat({
  libraryPath,
  provider,
  prompt,
  context,
  attachmentPaths = [],
  runtime,
  cliPath,
}: {
  libraryPath: string;
  provider: AgentProvider;
  prompt: string;
  context: string;
  attachmentPaths?: string[];
  runtime?: AgentRuntimeSettings;
  threadId?: string;
  cliPath?: string;
}): Promise<{ output: string; error: string; command: string }> {
  if (!isTauriRuntime()) {
    return {
      output: "浏览器开发模式不能直接调用本机 AI CLI。请用 `npm run dev` 启动 Tauri 桌面应用后再发送消息。",
      error: "",
      command: "browser-fallback",
    };
  }

  return invoke<{ output: string; error: string; command: string }>("run_agent_chat", {
    path: libraryPath,
    provider,
    prompt,
    context,
    attachmentPaths,
    runtime: runtime ?? null,
    cliPath: cliPath?.trim() || null,
  });
}

export function prewarmAgentRuntime(provider: AgentProvider, cliPath?: string): Promise<void> {
  if (!isTauriRuntime()) return Promise.resolve();
  const normalizedPath = cliPath?.trim() || "";
  const warmupKey = runtimeWarmupKey(provider, normalizedPath);
  const activeWarmup = activeRuntimeWarmups.get(warmupKey);
  if (activeWarmup) return activeWarmup;

  const warmup = invoke<void>("prewarm_agent_runtime", {
    provider,
    cliPath: normalizedPath || null,
  });
  activeRuntimeWarmups.set(warmupKey, warmup);
  warmup.then(
    () => activeRuntimeWarmups.delete(warmupKey),
    () => activeRuntimeWarmups.delete(warmupKey),
  );
  return warmup;
}

export async function streamAgentChat({
  libraryPath,
  provider,
  prompt,
  context,
  attachmentPaths = [],
  runtime,
  threadId,
  cliPath,
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
  threadId?: string;
  cliPath?: string;
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
    onDelta("浏览器开发模式不能直接调用本机 AI CLI。请用 `npm run dev` 启动 Tauri 桌面应用后再发送消息。");
    onDone?.();
    return;
  }

  await activeRuntimeWarmups.get(runtimeWarmupKey(provider, cliPath))?.catch(() => undefined);

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

    listen<AgentChatStreamEvent>(agentStreamEventName(requestId), (event) => {
      const payload = event.payload;
      if (payload.requestId !== requestId) return;

      if (payload.kind === "delta" && payload.text) {
        onDelta(payload.text, payload);
        return;
      }

      if (payload.kind === "message") {
        onMessage?.(payload.text || "", payload);
        return;
      }

      if (payload.kind === "status") {
        onStatus?.(payload);
        return;
      }

      if (payload.kind === "activity" || payload.kind === "approval") {
        onActivity?.(payload);
        return;
      }

      if (payload.kind === "usage") {
        if (payload.usage) onUsage?.(payload.usage);
        return;
      }

      if (payload.kind === "metric") {
        onMetric?.(payload);
        return;
      }

      if (payload.kind === "error") {
        onError?.(payload.error || payload.text || "本机 AI CLI 返回了错误。");
        finish();
        return;
      }

      if (payload.kind === "cancelled") {
        onCancelled?.(payload.text || "已取消本次请求。");
        finish();
        return;
      }

      if (payload.kind === "done") {
        finish();
      }
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
          threadId: threadId?.trim() || null,
          cliPath: cliPath?.trim() || null,
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
  return invoke<void>("cancel_agent_chat_stream", {
    requestId,
  });
}

export async function steerAgentChatStream(requestId: string, text: string): Promise<void> {
  if (!isTauriRuntime() || !requestId || !text.trim()) return;
  return invoke<void>("steer_agent_chat_stream", {
    requestId,
    text,
  });
}

export async function respondAgentApproval(
  approvalId: string,
  decision: "accept" | "acceptForSession" | "decline" | "cancel",
): Promise<void> {
  if (!isTauriRuntime()) return;
  return invoke<void>("respond_agent_approval", {
    approvalId,
    decision,
  });
}

export async function probeAgentCli(provider: AgentProvider, cliPath?: string): Promise<CodexProbeResult> {
  if (!isTauriRuntime()) {
    return {
      resolvedPath: "",
      ok: false,
      steps: [
        {
          name: "browser",
          ok: false,
          command: "probeAgentCli",
          stdout: "",
          stderr: "浏览器开发模式不能探测本机 AI CLI。请用 `npm run dev` 启动 Tauri 桌面应用。",
        },
      ],
    };
  }

  return invoke<CodexProbeResult>("probe_agent_cli", {
    provider,
    cliPath: cliPath?.trim() || null,
  });
}
