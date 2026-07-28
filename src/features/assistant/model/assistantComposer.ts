/**
 * [INPUT]: 依赖 shared 公共契约
 * [OUTPUT]: 对外提供输入法/发送、slash 与 mention 建议、模型紧凑标签，以及 Provider catalog 默认模型与思考能力收敛等公开能力
 * [POS]: AI 助手 feature 的领域模型边界，集中 AI 助手 规则、数据转换与外部契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type {
  AgentModelCatalog,
  AgentProvider,
  AgentSkill,
  AiDocumentReference,
  AiMountedContext,
  AssistantSendMode,
} from "@/shared/types";
import { currentShortcutPlatform, isPlatformModKeyPressed, type ShortcutPlatform } from "@/shared/lib/keyboardShortcuts";

interface ImeKeyboardEvent {
  isComposing?: boolean;
  keyCode?: number;
}

export function isImeCompositionKey(event: ImeKeyboardEvent, compositionActive = false) {
  return compositionActive || event.isComposing === true || event.keyCode === 229;
}

interface AssistantComposerKeyboardEvent {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
}

export function shouldSubmitAssistantComposer(
  event: AssistantComposerKeyboardEvent,
  sendMode: AssistantSendMode,
  platform: ShortcutPlatform = currentShortcutPlatform(),
) {
  if (event.key !== "Enter") return false;
  return sendMode === "mod-enter" ? isPlatformModKeyPressed(event, platform) : !event.shiftKey;
}

export function getSkillSlashTrigger(value: string, cursor: number) {
  const beforeCursor = value.slice(0, cursor);
  const match = beforeCursor.match(/(?:^|\s)\/([^\s/]*)$/);
  if (!match || typeof match.index !== "number") return null;
  const slashOffset = match[0].lastIndexOf("/");
  const from = match.index + slashOffset;
  return {
    from,
    to: cursor,
    query: match[1] ?? "",
  };
}

export function insertQuickPromptAtTrigger(value: string, trigger: { from: number; to: number }, content: string) {
  const before = value.slice(0, trigger.from);
  const after = value.slice(trigger.to);
  return {
    value: `${before}${content}${after}`,
    cursor: before.length + content.length,
  };
}

export function getDocumentMentionTrigger(value: string, cursor: number) {
  const beforeCursor = value.slice(0, cursor);
  const match = beforeCursor.match(/(?:^|\s)@([^\s@/]*)$/);
  if (!match || typeof match.index !== "number") return null;
  const mentionOffset = match[0].lastIndexOf("@");
  const from = match.index + mentionOffset;
  return {
    from,
    to: cursor,
    query: match[1] ?? "",
  };
}

export function filterSkillSuggestions(skills: AgentSkill[], query: string, mountedSkills: AgentSkill[]) {
  const mountedPaths = new Set(mountedSkills.map((skill) => skill.path));
  const needle = query.trim().toLowerCase();
  return skills
    .filter((skill) => !mountedPaths.has(skill.path))
    .map((skill, index) => ({ skill, index, score: scoreSkillSuggestion(skill, needle) }))
    .filter((item) => item.score !== null)
    .sort((left, right) => (left.score ?? 0) - (right.score ?? 0) || left.index - right.index)
    .map((item) => item.skill);
}

export function filterDocumentSuggestions(documents: AiDocumentReference[], query: string, mountedContexts: AiMountedContext[]) {
  const mountedSheetIds = new Set(mountedContexts.filter((context) => context.type === "document").map((context) => context.sheetId));
  const needle = query.trim().toLowerCase();
  return documents
    .filter((document) => !mountedSheetIds.has(document.sheetId))
    .map((document, index) => ({ document, index, score: scoreDocumentSuggestion(document, needle) }))
    .filter((item) => item.score !== null)
    .sort((left, right) => (left.score ?? 0) - (right.score ?? 0) || left.index - right.index)
    .map((item) => item.document);
}

export function getReasoningLevels(catalog: AgentModelCatalog | null, modelSlug: string, current: string) {
  const model = catalog?.models.find((item) => item.slug === modelSlug);
  if (model && (!model.supportsReasoning || model.supportedReasoningLevels.length === 0)) return [];
  const levels = model?.supportedReasoningLevels.map((level) => level.effort).filter(Boolean) ?? [];
  const withCurrent = current && !levels.includes(current) ? [...levels, current] : levels;
  return withCurrent.length > 0 ? withCurrent : ["low", "medium", "high"];
}

export function buildModelOptions(catalog: AgentModelCatalog | null, current: string) {
  const options =
    catalog?.models.map((model) => ({
      value: model.slug,
      label: model.displayName || model.slug,
    })) ?? [];
  if (current && !options.some((option) => option.value === current)) {
    return [...options, { value: current, label: current }];
  }
  return options.length > 0 ? options : [{ value: current || "auto", label: current || "auto" }];
}

export function resolveModelCatalogSelection(catalog: AgentModelCatalog, currentModel: string, currentReasoningEffort: string) {
  const model = catalog.models.some((option) => option.slug === currentModel) ? currentModel : catalog.currentModel;
  const modelOption = catalog.models.find((option) => option.slug === model);
  if (!modelOption?.supportsReasoning) return { model, reasoningEffort: "" };

  const supportedEfforts = modelOption.supportedReasoningLevels.map((level) => level.effort);
  const reasoningEffort = supportedEfforts.includes(currentReasoningEffort)
    ? currentReasoningEffort
    : modelOption.defaultReasoningLevel || catalog.currentReasoningEffort;
  return { model, reasoningEffort };
}

export function formatReasoningLevel(level: string) {
  const labels: Record<string, string> = {
    none: "关闭",
    minimal: "最小",
    low: "低",
    medium: "中",
    high: "高",
    xhigh: "极高",
    max: "最高",
    ultra: "极致",
    disabled: "关闭",
    enabled: "开启",
  };
  return labels[level] ?? level;
}

export function formatCompactModelLabel(provider: AgentProvider, label: string) {
  const normalized = label.trim();
  if (!normalized) return "模型";
  const providerPrefix: Partial<Record<AgentProvider, RegExp>> = {
    "chatgpt-subscription": /^(?:chatgpt|openai|gpt)(?:[-\s]+)?/i,
    "openai-api": /^(?:chatgpt|openai|gpt)(?:[-\s]+)?/i,
    "anthropic-api": /^(?:anthropic|claude)(?:[-\s]+)?/i,
    "qwen-api": /^(?:qwen|千问)(?:[-\s]+)?/i,
    "minimax-api": /^minimax(?:[-\s]+)?/i,
    "deepseek-api": /^deepseek(?:[-\s]+)?/i,
    "kimi-api": /^(?:kimi|moonshot)(?:[-\s]+)?/i,
  };
  const prefix = providerPrefix[provider];
  const compact = (prefix ? normalized.replace(prefix, "") : normalized).replace(/-/g, " ").replace(/\s+/g, " ").trim();
  return compact || normalized;
}

export function modelSupportsQuickMode(catalog: AgentModelCatalog | null, modelSlug: string) {
  const model = catalog?.models.find((item) => item.slug === modelSlug);
  return Boolean(model?.additionalSpeedTiers.includes("fast") || model?.serviceTiers.some((tier) => tier.id === "priority"));
}

function scoreDocumentSuggestion(document: AiDocumentReference, needle: string) {
  if (!needle) return 10;
  const title = document.title.toLowerCase();
  const subtitle = document.subtitle.toLowerCase();
  const summary = document.summary.toLowerCase();
  if (title.startsWith(needle)) return 0;
  if (title.includes(needle)) return 1;
  if (subtitle.includes(needle)) return 2;
  if (summary.includes(needle)) return 3;
  return null;
}

function scoreSkillSuggestion(skill: AgentSkill, needle: string) {
  const name = skill.name.toLowerCase();
  const id = skill.id.toLowerCase();
  const description = skill.description.toLowerCase();
  if (!needle) return 10;
  if (name.startsWith(needle)) return 0;
  if (id.startsWith(needle)) return 1;
  if (name.includes(needle)) return 2;
  if (id.includes(needle)) return 3;
  if (description.includes(needle)) return 4;
  return null;
}
