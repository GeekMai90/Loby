/**
 * [INPUT]: 依赖 shared AgentProvider 封闭契约
 * [OUTPUT]: 对外提供 AgentConnectionCapability 与各 Provider 已接入能力的唯一映射
 * [POS]: AI 助手 model 层的连接能力目录，供设置页筛选服务和展示能力，不根据名称猜测未接入协议
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { AgentProvider } from "@/shared/types";

export type AgentConnectionCapability = "text" | "reasoning" | "imageGeneration";

const PROVIDER_CAPABILITIES: Record<AgentProvider, readonly AgentConnectionCapability[]> = {
  "openai-api": ["text", "reasoning", "imageGeneration"],
  "anthropic-api": ["text", "reasoning"],
  "qwen-api": ["text", "reasoning"],
  "minimax-api": ["text", "reasoning"],
  "deepseek-api": ["text", "reasoning"],
  "kimi-api": ["text", "reasoning"],
  "openai-compatible": ["text"],
  "chatgpt-subscription": ["text", "reasoning", "imageGeneration"],
};

export function agentConnectionCapabilities(provider: AgentProvider): AgentConnectionCapability[] {
  return [...PROVIDER_CAPABILITIES[provider]];
}
