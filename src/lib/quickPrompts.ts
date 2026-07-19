import type { AiQuickPrompt, AiQuickPromptStore } from "../types";

export const MAX_AI_QUICK_PROMPTS = 20;
export const MAX_AI_QUICK_PROMPT_TITLE_LENGTH = 40;
export const MAX_AI_QUICK_PROMPT_CONTENT_LENGTH = 8000;

export function normalizeQuickPromptStore(value: unknown): AiQuickPromptStore {
  if (!value || typeof value !== "object") return emptyQuickPromptStore();
  const candidate = value as { prompts?: unknown };
  if (!Array.isArray(candidate.prompts)) return emptyQuickPromptStore();

  const seenIds = new Set<string>();
  const prompts: AiQuickPrompt[] = [];
  for (const value of candidate.prompts) {
    const prompt = normalizeQuickPrompt(value);
    if (!prompt || seenIds.has(prompt.id)) continue;
    seenIds.add(prompt.id);
    prompts.push(prompt);
    if (prompts.length >= MAX_AI_QUICK_PROMPTS) break;
  }
  return { version: 1, prompts };
}

export function emptyQuickPromptStore(): AiQuickPromptStore {
  return { version: 1, prompts: [] };
}

export function createQuickPrompt(title: string, content: string, now = new Date().toISOString(), id = createId()): AiQuickPrompt {
  return {
    id,
    title: normalizeTitle(title),
    content: normalizeContent(content),
    createdAt: now,
    updatedAt: now,
  };
}

export function updateQuickPrompt(prompt: AiQuickPrompt, title: string, content: string, now = new Date().toISOString()): AiQuickPrompt {
  return {
    ...prompt,
    title: normalizeTitle(title),
    content: normalizeContent(content),
    updatedAt: now,
  };
}

export function filterQuickPromptSuggestions(prompts: AiQuickPrompt[], query: string): AiQuickPrompt[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return prompts;
  return prompts
    .map((prompt, index) => ({ prompt, index, score: scoreQuickPrompt(prompt, needle) }))
    .filter((item) => item.score !== null)
    .sort((left, right) => (left.score ?? 0) - (right.score ?? 0) || left.index - right.index)
    .map((item) => item.prompt);
}

function normalizeQuickPrompt(value: unknown): AiQuickPrompt | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<AiQuickPrompt>;
  const title = normalizeTitle(candidate.title ?? "");
  const content = normalizeContent(candidate.content ?? "");
  if (!title || !content || typeof candidate.id !== "string" || !candidate.id.trim()) return null;
  const createdAt = typeof candidate.createdAt === "string" && candidate.createdAt ? candidate.createdAt : new Date(0).toISOString();
  const updatedAt = typeof candidate.updatedAt === "string" && candidate.updatedAt ? candidate.updatedAt : createdAt;
  return { id: candidate.id.trim(), title, content, createdAt, updatedAt };
}

function normalizeTitle(title: string) {
  return title.trim().slice(0, MAX_AI_QUICK_PROMPT_TITLE_LENGTH);
}

function normalizeContent(content: string) {
  return content.trim().slice(0, MAX_AI_QUICK_PROMPT_CONTENT_LENGTH);
}

function scoreQuickPrompt(prompt: AiQuickPrompt, needle: string) {
  const title = prompt.title.toLowerCase();
  const content = prompt.content.toLowerCase();
  if (title.startsWith(needle)) return 0;
  if (title.includes(needle)) return 1;
  if (content.includes(needle)) return 2;
  return null;
}

function createId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `quick-prompt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
