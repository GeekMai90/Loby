/**
 * [INPUT]: 依赖默认 AI Provider/模型/推理设置、凭证状态、当前文稿实时正文 reader 与摘要/图片搜索词模型
 * [OUTPUT]: 对外提供 useAiContentGenerators，按统一 runtime 与凭证门禁返回摘要、图片搜索词和 AI 搜索词翻译生成器
 * [POS]: assistant feature 的一次性内容生成协调边界；统一请求配置但不拥有 Provider 设置、编辑器状态、媒体翻译路由或文稿写回
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useCallback } from "react";
import type {
  AgentCredentialStatus,
  AgentModel,
  AgentProvider,
  AgentReasoningEffort,
  DocumentSummaryGenerator,
  WritingSheet,
} from "@/shared/types";
import { canGenerateDocumentSummary, generateDocumentSummary as requestDocumentSummary } from "@/features/assistant/model/documentSummary";
import {
  canGenerateImageSearchQuery,
  generateImageSearchQuery as requestImageSearchQuery,
  translateImageSearchQuery as requestImageSearchTranslation,
} from "@/features/assistant/model/imageSearchQuery";
import { resolveAgentRuntimeSettings } from "@/features/assistant/model/agentRuntimeSettings";

interface UseAiContentGeneratorsOptions {
  libraryPath: string;
  provider: AgentProvider;
  model: AgentModel;
  reasoningEffort: AgentReasoningEffort;
  quickMode: boolean;
  providerBaseUrl: string;
  credentialStatus: Pick<AgentCredentialStatus, "provider" | "configured"> | null | undefined;
  activeSheetId: string;
  readActiveEditorBody: () => string | undefined;
}

export function useAiContentGenerators({
  libraryPath,
  provider,
  model,
  reasoningEffort,
  quickMode,
  providerBaseUrl,
  credentialStatus,
  activeSheetId,
  readActiveEditorBody,
}: UseAiContentGeneratorsOptions) {
  const runtimeForRequest = useCallback(
    () => resolveAgentRuntimeSettings(provider, model, reasoningEffort, quickMode, providerBaseUrl),
    [model, provider, providerBaseUrl, quickMode, reasoningEffort],
  );

  const generateDocumentSummary = useCallback<DocumentSummaryGenerator>(
    (sheet) =>
      requestDocumentSummary({
        libraryPath,
        provider,
        runtime: runtimeForRequest(),
        sheet,
      }),
    [libraryPath, provider, runtimeForRequest],
  );

  const generateImageSearchQuery = useCallback(
    (sheet: WritingSheet) =>
      requestImageSearchQuery({
        provider,
        runtime: runtimeForRequest(),
        sheet: {
          ...sheet,
          body: activeSheetId === sheet.id ? (readActiveEditorBody() ?? sheet.body) : sheet.body,
        },
      }),
    [activeSheetId, provider, readActiveEditorBody, runtimeForRequest],
  );

  const translateImageSearchQuery = useCallback(
    (query: string) =>
      requestImageSearchTranslation({
        provider,
        runtime: runtimeForRequest(),
        query,
      }),
    [provider, runtimeForRequest],
  );

  return {
    documentSummaryGenerator: canGenerateDocumentSummary(provider, credentialStatus) ? generateDocumentSummary : undefined,
    imageSearchQueryGenerator: canGenerateImageSearchQuery(provider, credentialStatus) ? generateImageSearchQuery : undefined,
    imageSearchQueryTranslator: canGenerateImageSearchQuery(provider, credentialStatus) ? translateImageSearchQuery : undefined,
  };
}
