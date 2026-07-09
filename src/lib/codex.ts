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
} from "../types";

interface AgentChatStreamEvent {
  requestId: string;
  kind: "started" | "delta" | "status" | "activity" | "approval" | "usage" | "done" | "error" | "cancelled";
  text?: string;
  error?: string;
  rawType?: string;
  itemId?: string;
  itemType?: string;
  status?: string;
  title?: string;
  command?: string;
  output?: string;
  exitCode?: number | null;
  usage?: AgentUsage;
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
  planMode,
  runtime,
  cliPath,
}: {
  libraryPath: string;
  provider: AgentProvider;
  prompt: string;
  context: string;
  planMode: boolean;
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
    planMode,
    runtime: runtime ?? null,
    cliPath: cliPath?.trim() || null,
  });
}

export async function streamAgentChat({
  libraryPath,
  provider,
  prompt,
  context,
  planMode,
  runtime,
  threadId,
  cliPath,
  onDelta,
  onStatus,
  onActivity,
  onUsage,
  onError,
  onCancelled,
  onDone,
  onRequestId,
}: {
  libraryPath: string;
  provider: AgentProvider;
  prompt: string;
  context: string;
  planMode: boolean;
  runtime?: AgentRuntimeSettings;
  threadId?: string;
  cliPath?: string;
  onDelta: (delta: string) => void;
  onStatus?: (event: AgentChatStreamEvent) => void;
  onActivity?: (event: AgentChatStreamEvent) => void;
  onUsage?: (usage: AgentUsage) => void;
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

    listen<AgentChatStreamEvent>("nibva://agent-chat-stream", (event) => {
      const payload = event.payload;
      if (payload.requestId !== requestId) return;

      if (payload.kind === "delta" && payload.text) {
        onDelta(payload.text);
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
          planMode,
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
