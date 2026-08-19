/**
 * [INPUT]: 依赖中文搜索词、可选 AI/百度翻译适配器与 Unsplash 搜索词归一化规则
 * [OUTPUT]: 对外提供中文检测、首选翻译服务、静默备用服务兜底与原词回退的 Unsplash 搜索词解析
 * [POS]: media feature 的搜索词编排边界；UI 只消费最终英文词和可展示提示，不直接耦合翻译服务
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { UnsplashSearchTranslationProvider } from "@/shared/types";
import { normalizeImageSearchQuery } from "@/features/assistant/model/imageSearchQuery";

export interface SearchQueryTranslationResult {
  originalQuery: string;
  effectiveQuery: string;
  translatedQuery: string;
  usedFallback: boolean;
  notice: string;
}

export async function resolveUnsplashSearchQuery({
  query,
  enabled,
  provider,
  translateWithAi,
  translateWithBaidu,
}: {
  query: string;
  enabled: boolean;
  provider: UnsplashSearchTranslationProvider;
  translateWithAi?: (query: string) => Promise<string>;
  translateWithBaidu?: (query: string) => Promise<string>;
}): Promise<SearchQueryTranslationResult> {
  const originalQuery = normalizeUserQuery(query);
  if (!originalQuery || !enabled || !containsChinese(originalQuery)) {
    return {
      originalQuery,
      effectiveQuery: originalQuery,
      translatedQuery: "",
      usedFallback: false,
      notice: "",
    };
  }

  const attempts = provider === "baidu" ? ["baidu", "ai"] : ["ai", "baidu"];
  const failures: string[] = [];
  for (const attempt of attempts) {
    const translate = attempt === "ai" ? translateWithAi : translateWithBaidu;
    if (!translate) {
      failures.push(attempt === "ai" ? "AI 翻译未配置" : "百度翻译未配置");
      continue;
    }
    try {
      const translatedQuery = normalizeImageSearchQuery(await translate(originalQuery));
      if (!translatedQuery) {
        failures.push(attempt === "ai" ? "AI 未返回有效英文关键词" : "百度翻译未返回有效英文关键词");
        continue;
      }
      return {
        originalQuery,
        effectiveQuery: translatedQuery,
        translatedQuery,
        usedFallback: false,
        notice: "",
      };
    } catch (cause) {
      failures.push(errorMessage(cause));
    }
  }

  return {
    originalQuery,
    effectiveQuery: originalQuery,
    translatedQuery: "",
    usedFallback: true,
    notice: `${failures.at(-1) ?? "翻译服务暂时不可用"}，已使用原词搜索。`,
  };
}

export function containsChinese(value: string): boolean {
  return /[\u3400-\u4dbf\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/u.test(value);
}

function normalizeUserQuery(value: string): string {
  return value.split(/\s+/u).join(" ").trim();
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
