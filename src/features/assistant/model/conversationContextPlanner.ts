/**
 * [INPUT]: 依赖 shared 会话、动作、变更与运行产物契约
 * [OUTPUT]: 对外提供 token 估算、模型上下文窗口解析、动作内容投影与带语义指纹的 append-only 会话有界模型视图规划
 * [POS]: AI 助手 model 层的 Conversation Context Planner；只压缩 Provider 投影，不删除或改写持久化消息事实
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type {
  AgentConversationMessage,
  AgentProvider,
  ChatMessage,
  ConversationCompactionCheckpoint,
  ConversationContextStats,
} from "@/shared/types";

const DEFAULT_OPENAI_CONTEXT_TOKENS = 128_000;
const DEFAULT_ANTHROPIC_CONTEXT_TOKENS = 200_000;
const DEFAULT_COMPATIBLE_CONTEXT_TOKENS = 64_000;
const MIN_RECENT_TURNS = 2;
const SUMMARY_MAX_TOKENS = 4_096;

export interface ConversationContextPlan {
  context: string;
  prompt: string;
  messages: AgentConversationMessage[];
  checkpoint?: ConversationCompactionCheckpoint;
  stats: ConversationContextStats;
}

interface PlanConversationContextInput {
  context: string;
  prompt: string;
  messages: ChatMessage[];
  provider: AgentProvider;
  model: string;
  previousCheckpoint?: ConversationCompactionCheckpoint;
  contextWindowTokens?: number;
  outputReserveTokens?: number;
  now?: string;
}

interface ConversationTurn {
  messages: AgentConversationMessage[];
  sourceIds: string[];
  estimatedTokens: number;
}

export function planConversationContext({
  context,
  prompt,
  messages,
  provider,
  model,
  previousCheckpoint,
  contextWindowTokens = modelContextWindowTokens(provider, model),
  outputReserveTokens,
  now = new Date().toISOString(),
}: PlanConversationContextInput): ConversationContextPlan {
  const safeWindow = Math.max(8_192, contextWindowTokens);
  const reserve = outputReserveTokens ?? Math.min(32_768, Math.max(8_192, Math.floor(safeWindow * 0.2)));
  const inputBudgetTokens = Math.max(4_096, safeWindow - reserve);
  const boundedPrompt = fitTextToTokenBudget(prompt, Math.max(1_024, Math.floor(inputBudgetTokens * 0.35)));
  const promptTokens = estimateConversationTokens(boundedPrompt);
  const contextBudget = Math.max(1_024, inputBudgetTokens - promptTokens - 768);
  const boundedContext = fitTextToTokenBudget(context, contextBudget);
  const stableContextTokens = estimateConversationTokens(boundedContext) + promptTokens + 256;
  const historyBudget = Math.max(512, inputBudgetTokens - stableContextTokens);
  const turns = groupConversationTurns(messages);
  const retainedTurns: ConversationTurn[] = [];
  let retainedTokens = 0;

  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const turn = turns[index];
    const mustRetain = retainedTurns.length < MIN_RECENT_TURNS;
    if (!mustRetain && retainedTokens + turn.estimatedTokens > historyBudget) break;
    retainedTurns.unshift(turn);
    retainedTokens += turn.estimatedTokens;
  }

  const retainedIds = new Set(retainedTurns.flatMap((turn) => turn.sourceIds));
  const compactedMessages = messages.filter((message) => !retainedIds.has(message.id));
  const checkpoint = compactedMessages.length
    ? createConversationCheckpoint(compactedMessages, Array.from(retainedIds), previousCheckpoint, now, historyBudget)
    : undefined;
  const checkpointTokens = checkpoint?.estimatedTokens ?? 0;
  const modelMessages = fitTurnsToTokenBudget(retainedTurns, Math.max(256, historyBudget - checkpointTokens));
  const modelMessageTokens = modelMessages.reduce((total, message) => total + estimateConversationTokens(message.content) + 8, 0);
  const historyTokens = modelMessageTokens + checkpointTokens;
  const projectedContext = checkpoint ? `${boundedContext}\n\n### 较早对话压缩检查点\n${checkpoint.summary}` : boundedContext;

  return {
    context: projectedContext,
    prompt: boundedPrompt,
    messages: modelMessages,
    checkpoint,
    stats: {
      contextWindowTokens: safeWindow,
      inputBudgetTokens,
      estimatedInputTokens: stableContextTokens + historyTokens,
      stableContextTokens,
      historyTokens,
      retainedMessageCount: modelMessages.length,
      compactedMessageCount: compactedMessages.length,
    },
  };
}

export function modelContextWindowTokens(provider: AgentProvider, model: string): number {
  if (provider === "anthropic-api" || model.toLowerCase().includes("claude")) {
    return DEFAULT_ANTHROPIC_CONTEXT_TOKENS;
  }
  if (provider === "deepseek-api") return 1_000_000;
  if (provider === "minimax-api") return 204_800;
  if (provider === "kimi-api") return 262_144;
  if (provider === "qwen-api") return 200_000;
  if (provider === "openai-compatible" || model === "custom") return DEFAULT_COMPATIBLE_CONTEXT_TOKENS;
  return DEFAULT_OPENAI_CONTEXT_TOKENS;
}

export function estimateConversationTokens(value: string): number {
  if (!value) return 0;
  let cjk = 0;
  let other = 0;
  for (const character of value) {
    if (/\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}|\p{Script=Hangul}/u.test(character)) cjk += 1;
    else other += 1;
  }
  return Math.max(1, cjk + Math.ceil(other / 4));
}

export function formatChatMessageForModel(message: ChatMessage): AgentConversationMessage | null {
  if (message.role === "system") return null;
  const sections = [message.content.trim()];
  const attachments = message.attachments?.map((attachment) => `${attachment.name}（${attachment.kind}）`) ?? [];
  if (attachments.length) sections.push(`附件：${attachments.join("、")}`);
  const actions = message.actions?.map((action) => {
    const result = action.result || action.error;
    const payload = summarizeActionPayload(action.payload);
    return `- ${action.title}｜${action.status}${payload ? `｜${payload}` : ""}${result ? `｜${boundedLine(result, 240)}` : ""}`;
  });
  if (actions?.length) sections.push(`文稿动作：\n${actions.join("\n")}`);
  const changes = message.changeSets?.map(
    (changeSet) =>
      `- ${changeSet.summary}｜${changeSet.status}｜提议正文：${fitTextToTokenBudget(changeSet.proposedBody, 320, "[正文中段已省略]")}`,
  );
  if (changes?.length) sections.push(`正文变更：\n${changes.join("\n")}`);
  const artifacts = message.run?.activities
    .filter((activity) => activity.artifactPath)
    .map((activity) => `- ${activity.title || "生成产物"}：${activity.artifactPath}`);
  if (artifacts?.length) sections.push(`运行产物：\n${artifacts.join("\n")}`);
  const content = sections.filter(Boolean).join("\n\n");
  if (!content) return null;
  return { id: message.id, role: message.role, content };
}

function groupConversationTurns(messages: ChatMessage[]): ConversationTurn[] {
  const turns: ConversationTurn[] = [];
  let current: AgentConversationMessage[] = [];
  let sourceIds: string[] = [];
  const flush = () => {
    if (!current.length) return;
    turns.push({
      messages: current,
      sourceIds,
      estimatedTokens: current.reduce((total, message) => total + estimateConversationTokens(message.content) + 8, 0),
    });
    current = [];
    sourceIds = [];
  };
  for (const source of messages) {
    const message = formatChatMessageForModel(source);
    if (!message) continue;
    if (message.role === "user" && current.length) flush();
    current.push(message);
    sourceIds.push(source.id);
  }
  flush();
  return turns;
}

function createConversationCheckpoint(
  messages: ChatMessage[],
  retainedMessageIds: string[],
  previous: ConversationCompactionCheckpoint | undefined,
  now: string,
  historyBudget: number,
): ConversationCompactionCheckpoint {
  const sourceMessageIds = messages.map((message) => message.id);
  const sourceFingerprint = conversationSemanticFingerprint(messages);
  if (
    previous &&
    arraysEqual(previous.sourceMessageIds, sourceMessageIds) &&
    arraysEqual(previous.retainedMessageIds, retainedMessageIds) &&
    previous.sourceFingerprint === sourceFingerprint
  ) {
    return previous;
  }
  const summaryBudget = Math.max(256, Math.min(SUMMARY_MAX_TOKENS, Math.floor(historyBudget * 0.4)));
  const summary = fitSummary(buildStructuredSummary(messages), summaryBudget);
  return {
    version: 1,
    id: `compact-${sourceMessageIds.at(-1) ?? "empty"}`,
    createdAt: now,
    sourceMessageIds,
    retainedMessageIds,
    sourceFingerprint,
    summary,
    estimatedTokens: estimateConversationTokens(summary),
  };
}

function buildStructuredSummary(messages: ChatMessage[]): string {
  const userFacts = uniqueLines(messages.filter((message) => message.role === "user").map((message) => boundedLine(message.content, 360)));
  const assistantFacts = uniqueLines(
    messages.filter((message) => message.role === "assistant").map((message) => boundedLine(message.content, 280)),
  );
  const workState = uniqueLines(
    messages.flatMap((message) => [
      ...(message.actions ?? []).map(
        (action) =>
          `${action.title}｜${action.status}｜${summarizeActionPayload(action.payload) || boundedLine(action.summary, 240)}${
            action.result || action.error ? `｜${boundedLine(action.result || action.error || "", 240)}` : ""
          }`,
      ),
      ...(message.changeSets ?? []).map(
        (changeSet) =>
          `${changeSet.summary}｜${changeSet.status}｜提议正文：${fitTextToTokenBudget(changeSet.proposedBody, 320, "[正文中段已省略]")}`,
      ),
      ...(message.run?.activities ?? [])
        .filter((activity) => activity.artifactPath)
        .map((activity) => `${activity.title || "生成产物"}｜${activity.artifactPath}`),
    ]),
  );
  return [
    "以下是较早对话的结构化检查点。原始消息仍保存在本地会话中；回答时延续用户已确认的约束和未完成事项。",
    summarySection("用户目标与约束", userFacts),
    summarySection("已有结论", assistantFacts),
    summarySection("动作、变更与产物状态", workState),
  ]
    .filter(Boolean)
    .join("\n\n");
}

function summarizeActionPayload(payload: Record<string, unknown>): string {
  const keys = ["target", "title", "text", "markdown", "body", "content", "path", "alt", "filename"];
  const details = keys.flatMap((key) => {
    const value = payload[key];
    if (typeof value !== "string" || !value.trim()) return [];
    return [`${key}=${boundedLine(value, 360)}`];
  });
  const items = Array.isArray(payload.items)
    ? payload.items.slice(0, 8).flatMap((item, index) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return [];
        const summary = summarizeActionPayload(item as Record<string, unknown>);
        return summary ? [`item${index + 1}={${summary}}`] : [];
      })
    : [];
  return [...details, ...items].join("；");
}

function conversationSemanticFingerprint(messages: ChatMessage[]): string {
  const semantic = messages
    .map(formatChatMessageForModel)
    .filter((message): message is AgentConversationMessage => Boolean(message))
    .map((message) => `${message.id}\u0000${message.role}\u0000${message.content}`)
    .join("\u0001");
  let hash = 0x811c9dc5;
  for (let index = 0; index < semantic.length; index += 1) {
    hash ^= semantic.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function summarySection(title: string, lines: string[]): string {
  return lines.length ? `#### ${title}\n${lines.map((line) => `- ${line}`).join("\n")}` : "";
}

function fitSummary(summary: string, budget: number): string {
  return fitTextToTokenBudget(summary, budget, "[中间较早细节已压缩；完整记录仍保存在本地]");
}

function fitTurnsToTokenBudget(turns: ConversationTurn[], budget: number): AgentConversationMessage[] {
  const selected: AgentConversationMessage[][] = [];
  let remaining = budget;
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const turn = turns[index];
    if (turn.estimatedTokens <= remaining) {
      selected.unshift(turn.messages);
      remaining -= turn.estimatedTokens;
      continue;
    }
    if (selected.length === 0) {
      const perMessageBudget = Math.max(64, Math.floor(remaining / Math.max(1, turn.messages.length)) - 8);
      selected.unshift(turn.messages.map((message) => ({ ...message, content: fitTextToTokenBudget(message.content, perMessageBudget) })));
    }
    break;
  }
  return selected.flat();
}

function fitTextToTokenBudget(value: string, budget: number, marker = "[中间内容已按模型窗口截断]"): string {
  if (estimateConversationTokens(value) <= budget) return value;
  let targetCharacters = Math.min(value.length, Math.max(64, budget * 3));
  while (targetCharacters >= 64) {
    const headLength = Math.floor(targetCharacters * 0.65);
    const tailLength = targetCharacters - headLength;
    const candidate = `${value.slice(0, headLength).trimEnd()}\n\n${marker}\n\n${value.slice(-tailLength).trimStart()}`;
    if (estimateConversationTokens(candidate) <= budget) return candidate;
    targetCharacters = Math.floor(targetCharacters * 0.8);
  }
  return `${value.slice(0, Math.max(16, budget - 16)).trimEnd()}…`;
}

function boundedLine(value: string, limit: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) return normalized;
  const headLength = Math.floor(limit * 0.65);
  const tailLength = Math.max(1, limit - headLength - 1);
  return `${normalized.slice(0, headLength)}…${normalized.slice(-tailLength)}`;
}

function uniqueLines(lines: string[]): string[] {
  return Array.from(new Set(lines.filter(Boolean)));
}

function arraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
