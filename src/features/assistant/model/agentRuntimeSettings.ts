/**
 * [INPUT]: 依赖 shared Agent runtime 契约与应用级 AI 设置
 * [OUTPUT]: 对外提供 resolveAgentRuntimeSettings，把主对话与 Inline AI 的 Provider 参数归一到同一请求配置
 * [POS]: AI 助手 model 层的运行配置适配器，避免不同入口复制并逐渐分叉 Provider 选择规则
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { AgentModel, AgentProvider, AgentReasoningEffort, AgentRuntimeSettings } from "@/shared/types";
import { loadAgentSettings } from "@/features/assistant/model/agentSettings";

export function resolveAgentRuntimeSettings(
  provider: AgentProvider,
  model: AgentModel,
  reasoningEffort: AgentReasoningEffort,
  quickMode: boolean,
  providerBaseUrl: string,
): AgentRuntimeSettings {
  return {
    model,
    reasoningEffort,
    quickMode,
    baseUrl: provider === "openai-compatible" ? providerBaseUrl : undefined,
    imageGenerationProvider: loadAgentSettings().imageGenerationProvider,
  };
}
