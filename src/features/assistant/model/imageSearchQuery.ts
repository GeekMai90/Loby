/**
 * [INPUT]: 依赖当前默认 AI Provider runtime、凭证状态与 WritingSheet 标题/摘要/正文
 * [OUTPUT]: 对外提供 Unsplash 默认英文搜索关键词的可用性判断、独立生成与严格英文短语归一化
 * [POS]: assistant feature 的封面检索词派生边界；只读取有界文稿内容并返回可编辑关键词，不复用摘要指令、不写入正文或文稿元数据
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { AgentCredentialStatus, AgentProvider, AgentRuntimeSettings, WritingSheet } from "@/shared/types";
import { requestImageSearchQuery, requestImageSearchTranslation } from "@/features/assistant/model/agentRuntime";

export const IMAGE_SEARCH_QUERY_MAX_CHARACTERS = 64;
const IMAGE_SEARCH_QUERY_MAX_WORDS = 5;
const IMAGE_SEARCH_QUERY_MIN_WORDS = 2;

const QUERY_PREFIX = /^(?:[-*•]\s*|\d+[.)、]\s*)?(?:关键词|搜索词|search\s*(?:query|terms?)|query)\s*[:：-]\s*/i;
const ENGLISH_WORD = "[A-Za-z]+(?:['’-][A-Za-z]+)?";
const ENGLISH_QUERY = new RegExp(
  `^${ENGLISH_WORD}(?:\\s+${ENGLISH_WORD}){${IMAGE_SEARCH_QUERY_MIN_WORDS - 1},${IMAGE_SEARCH_QUERY_MAX_WORDS - 1}}$`,
);

export function canGenerateImageSearchQuery(
  provider: AgentProvider,
  credentialStatus: Pick<AgentCredentialStatus, "provider" | "configured"> | null | undefined,
): boolean {
  return credentialStatus?.provider === provider && credentialStatus.configured;
}

export async function generateImageSearchQuery({
  provider,
  runtime,
  sheet,
}: {
  provider: AgentProvider;
  runtime: AgentRuntimeSettings;
  sheet: Pick<WritingSheet, "title" | "description" | "body">;
}): Promise<string> {
  const title = sheet.title.trim() || "无标题文章";
  const description = sheet.description.trim();
  const body = sheet.body.trim();
  if (!body && !description) throw new Error("文章内容为空，无法生成图片搜索词。");

  const output = await requestImageSearchQuery({
    provider,
    context: [
      `<article-title>${title}</article-title>`,
      description ? `<article-description>${description}</article-description>` : "",
      `<article-body>${boundedArticleBody(body)}</article-body>`,
    ]
      .filter(Boolean)
      .join("\n\n"),
    runtime,
  });

  const query = normalizeImageSearchQuery(output);
  if (!query) throw new Error("AI 未生成有效的英文图片搜索词，请手动输入。");
  return query;
}

export async function translateImageSearchQuery({
  provider,
  runtime,
  query,
}: {
  provider: AgentProvider;
  runtime: AgentRuntimeSettings;
  query: string;
}): Promise<string> {
  const output = await requestImageSearchTranslation({ provider, query, runtime });
  const normalized = normalizeImageSearchQuery(output);
  if (!normalized) throw new Error("AI 未生成有效的英文搜索词。");
  return normalized;
}

export function normalizeImageSearchQuery(output: string): string {
  const plainOutput = output
    .replace(/```(?:json|text|markdown)?/gi, "")
    .replace(/```/g, "")
    .trim();
  if (!plainOutput) return "";

  const jsonQuery = extractJsonQuery(plainOutput);
  const quotedQueries = Array.from(plainOutput.matchAll(/["“”']([^"“”'\r\n]+)["“”']/g), (match) => match[1]);
  const lineQueries = plainOutput.split(/\r?\n/);
  const candidates = [jsonQuery, ...lineQueries.filter((line) => QUERY_PREFIX.test(line.trim())), ...quotedQueries, ...lineQueries];

  for (const candidate of candidates) {
    const query = normalizeCandidate(candidate);
    if (query) return query;
  }
  return "";
}

function boundedArticleBody(body: string): string {
  if (body.length <= 8_000) return body;
  return `${body.slice(0, 6_000)}\n\n[正文中段已省略]\n\n${body.slice(-2_000)}`;
}

function extractJsonQuery(output: string): string {
  try {
    const value = JSON.parse(output) as unknown;
    if (value && typeof value === "object" && "query" in value && typeof value.query === "string") return value.query;
  } catch {
    const match = output.match(/["']query["']\s*:\s*["']([^"']+)["']/i);
    if (match) return match[1];
  }
  return "";
}

function normalizeCandidate(candidate: string): string {
  const normalized = candidate
    .trim()
    .replace(QUERY_PREFIX, "")
    .replace(/^(?:[-*•]\s*|\d+[.)、]\s*)/, "")
    .replace(/^[「『“”"']+|[」』“”"']+$/g, "")
    .replace(/\s*[,，;/|]\s*/g, " ")
    .replace(/[.,，。；;:：!?！？]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (normalized.length > IMAGE_SEARCH_QUERY_MAX_CHARACTERS || !ENGLISH_QUERY.test(normalized)) return "";
  return normalized.toLowerCase();
}
