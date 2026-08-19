/**
 * [INPUT]: 依赖 shared Provider/模型目录契约与 Agent 连接、凭证和模型目录 IPC
 * [OUTPUT]: 对外提供 AgentConnectionDirectoryItem、已配置连接目录加载、可用连接探测与稳定名称排序
 * [POS]: AI 助手 model 层的可用连接投影边界，只暴露已完成配置且可供当前对话选择的 Provider
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { AgentModelCatalog, AgentProvider } from "@/shared/types";
import { getAgentCredentialStatus, getChatGptConnection, listAgentModels } from "@/features/assistant/model/agentRuntime";

export interface AgentConnectionDirectoryItem {
  provider: AgentProvider;
  label: string;
  modelCatalog: AgentModelCatalog | null;
}

interface ConfiguredConnection {
  provider: AgentProvider;
  label: string;
}

const API_CONNECTIONS: ReadonlyArray<{ provider: AgentProvider; label: string }> = [
  { provider: "openai-api", label: "OpenAI" },
  { provider: "anthropic-api", label: "Anthropic" },
  { provider: "qwen-api", label: "千问" },
  { provider: "minimax-api", label: "MiniMax" },
  { provider: "deepseek-api", label: "DeepSeek" },
  { provider: "kimi-api", label: "Kimi" },
  { provider: "openai-compatible", label: "自定义服务商" },
];

export async function loadAgentConnectionDirectory(): Promise<AgentConnectionDirectoryItem[]> {
  const configured = await loadConfiguredConnections();
  const withCatalogs = await Promise.all(
    configured.map(async (connection): Promise<AgentConnectionDirectoryItem> => {
      const modelCatalog = await listAgentModels(connection.provider).catch(() => null);
      return { ...connection, modelCatalog };
    }),
  );
  return withCatalogs.sort((left, right) => left.label.localeCompare(right.label, "en", { sensitivity: "base" }));
}

export async function hasConfiguredAgentConnection(): Promise<boolean> {
  const configured = await loadConfiguredConnections();
  return configured.length > 0;
}

async function loadConfiguredConnections(): Promise<ConfiguredConnection[]> {
  const [chatGptResult, ...credentialResults] = await Promise.allSettled([
    getChatGptConnection(),
    ...API_CONNECTIONS.map((connection) => getAgentCredentialStatus(connection.provider)),
  ]);
  const configured: ConfiguredConnection[] = [];

  if (chatGptResult.status === "fulfilled" && chatGptResult.value.connected) {
    configured.push({ provider: "chatgpt-subscription", label: "ChatGPT" });
  }
  credentialResults.forEach((result, index) => {
    const connection = API_CONNECTIONS[index];
    if (connection && result.status === "fulfilled" && result.value.configured) configured.push(connection);
  });

  return configured;
}
