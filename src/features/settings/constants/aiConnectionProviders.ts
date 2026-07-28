/**
 * [INPUT]: 依赖 shared AgentProvider 封闭契约
 * [OUTPUT]: 对外提供设置页已支持 API 服务商的稳定顺序、显示名称与官方 Endpoint
 * [POS]: settings constants 的连接预设目录；固定服务只读地址与自定义服务可编辑边界的唯一前端来源
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { AgentProvider } from "@/shared/types";

export interface ApiConnectionPreset {
  id: string;
  label: string;
  provider: AgentProvider;
  endpoint: string;
}

export const API_CONNECTION_PRESETS: ApiConnectionPreset[] = [
  { id: "openai", label: "OpenAI", provider: "openai-api", endpoint: "https://api.openai.com/v1" },
  { id: "anthropic", label: "Anthropic", provider: "anthropic-api", endpoint: "https://api.anthropic.com" },
  {
    id: "qwen",
    label: "千问",
    provider: "qwen-api",
    endpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  },
  { id: "minimax", label: "MiniMax", provider: "minimax-api", endpoint: "https://api.minimaxi.com/v1" },
  { id: "deepseek", label: "DeepSeek", provider: "deepseek-api", endpoint: "https://api.deepseek.com" },
  { id: "kimi", label: "Kimi", provider: "kimi-api", endpoint: "https://api.moonshot.cn/v1" },
  { id: "custom", label: "自定义服务商", provider: "openai-compatible", endpoint: "" },
];

export const API_CONNECTION_PROVIDERS = API_CONNECTION_PRESETS.map((preset) => preset.provider);

export function apiConnectionPresetForProvider(provider: AgentProvider | null): ApiConnectionPreset {
  return API_CONNECTION_PRESETS.find((preset) => preset.provider === provider) ?? API_CONNECTION_PRESETS[0];
}
