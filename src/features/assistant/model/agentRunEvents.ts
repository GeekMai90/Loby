/**
 * [INPUT]: 依赖 shared AgentRunActivity 的 typed kind/state/visibility 契约与旧会话原始字段
 * [OUTPUT]: 对外提供 activityFromAgentEvent、类型/生命周期/可见性解析；typed 事件保留原生 item id，旧会话才使用稳定别名与标题兼容
 * [POS]: AI 助手运行协议适配边界，保证 activeItemId 可指向 typed activity，并隔离 legacy 推断
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { AgentActivityKind, AgentActivityState, AgentActivityVisibility, AgentRunActivity } from "@/shared/types";

export interface AgentActivityEvent {
  activityKind?: AgentActivityKind;
  activityState?: AgentActivityState;
  visibility?: AgentActivityVisibility;
  sequence?: number;
  emittedAtMs?: number;
  parentId?: string;
  rawType?: string;
  itemType?: string;
  phase?: string;
  title?: string;
  status?: string;
  toolName?: string;
  command?: string;
  output?: string;
  text?: string;
  artifactPath?: string;
  exitCode?: number | null;
}

export function activityFromAgentEvent(id: string, event: AgentActivityEvent, fallbackTitle = ""): AgentRunActivity {
  const kind = id === "provider-request" ? "status" : inferAgentActivityKind(event);
  const state = event.activityState ?? normalizeAgentActivityState(event.status);
  const activityId = event.activityKind
    ? id
    : kind === "modelResponse"
      ? "assistant-message-stream"
      : kind === "reasoning"
        ? "assistant-reasoning-stream"
        : id;
  return {
    id: activityId,
    kind,
    state,
    visibility: event.visibility ?? defaultActivityVisibility(kind),
    sequence: event.sequence,
    emittedAtMs: event.emittedAtMs,
    parentId: event.parentId,
    rawType: event.rawType || "",
    title: event.title || fallbackTitle,
    status: event.status || "",
    toolName: event.toolName || inferToolName(event.title || ""),
    command: event.command || "",
    output: event.output || "",
    text: event.text || "",
    exitCode: event.exitCode ?? null,
    artifactPath: event.artifactPath || undefined,
  };
}

export function writingContextActivity(status: "in_progress" | "completed"): AgentRunActivity {
  return activityFromAgentEvent("prepare-writing-context", {
    activityKind: "context",
    activityState: status === "completed" ? "completed" : "running",
    visibility: "diagnostic",
    rawType: "agent/context",
    title: status === "completed" ? "写作上下文已准备" : "准备写作上下文",
    status,
  });
}

export function resolveAgentActivityKind(activity: AgentRunActivity): AgentActivityKind {
  return activity.kind ?? inferAgentActivityKind(activity);
}

export function resolveAgentActivityState(activity: AgentRunActivity): AgentActivityState {
  return activity.state ?? normalizeAgentActivityState(activity.status);
}

export function resolveAgentActivityVisibility(activity: AgentRunActivity): AgentActivityVisibility {
  return activity.visibility ?? defaultActivityVisibility(resolveAgentActivityKind(activity));
}

function inferAgentActivityKind(event: AgentActivityEvent): AgentActivityKind {
  if (event.activityKind) return event.activityKind;
  const rawType = (event.rawType || "").toLowerCase();
  const itemType = (event.itemType || "").toLowerCase();
  const title = (event.title || "").toLowerCase();
  const toolName = (event.toolName || inferToolName(event.title || "")).toLowerCase();
  const combined = `${rawType} ${itemType} ${title} ${toolName}`;

  if (combined.includes("requestapproval") || itemType === "approval") return "approval";
  if (combined.includes("proposal")) return "proposal";
  if (combined.includes("reasoning") || title.includes("思考") || title.includes("思路") || title.includes("模型准备调用工具")) {
    return "reasoning";
  }
  if (
    combined.includes("agentmessage") ||
    itemType === "modelresponse" ||
    title.includes("生成回复") ||
    title.includes("回复已生成") ||
    title.includes("请求模型") ||
    title.includes("模型请求") ||
    title.includes("模型开始响应") ||
    title.includes("模型回复完成")
  ) {
    return "modelResponse";
  }
  if (combined.includes("imagegeneration") || combined.includes("generate_image") || title.includes("生成图片")) {
    return "imageGeneration";
  }
  if (combined.includes("websearch") || combined.includes("web_search") || combined.includes("search_web") || title.includes("搜索资料")) {
    return "webSearch";
  }
  if (combined.includes("activate_skill") || combined.includes("skill")) return "skill";
  if (combined.includes("commandexecution") || title.includes("命令")) return "command";
  if (combined.includes("filechange") || title.includes("文件修改") || title.includes("文稿修改")) return "fileChange";
  if (rawType === "agent/context" || title.includes("写作上下文")) return "context";
  if (itemType === "toolcall" || rawType.includes("agent/tool") || title.includes("调用")) return "tool";
  if (rawType.includes("status") || title.includes("agent 状态")) return "status";
  return "unknown";
}

function defaultActivityVisibility(kind: AgentActivityKind): AgentActivityVisibility {
  if (kind === "status" || kind === "modelResponse" || kind === "context") return "diagnostic";
  if (kind === "reasoning") return "detail";
  return "milestone";
}

function normalizeAgentActivityState(status = ""): AgentActivityState {
  switch (status.toLowerCase()) {
    case "queued":
      return "queued";
    case "pending":
    case "awaiting_approval":
    case "awaitingapproval":
      return "awaitingApproval";
    case "completed":
    case "done":
    case "success":
      return "completed";
    case "failed":
    case "error":
    case "errored":
      return "failed";
    case "cancelled":
    case "canceled":
    case "decline":
    case "declined":
      return "cancelled";
    case "in_progress":
    case "running":
    case "active":
      return "running";
    default:
      return "unknown";
  }
}

function inferToolName(title: string) {
  const normalized = title.trim();
  const prefixMatch = normalized.match(/^(?:准备调用|调用|完成)\s+(.+)$/);
  if (prefixMatch) return prefixMatch[1].trim();
  const failureMatch = normalized.match(/^(.+?)\s+调用失败$/);
  return failureMatch?.[1]?.trim() || "";
}
