/**
 * [INPUT]: 依赖 Vitest、Agent runtime mock 与已配置连接目录加载器
 * [OUTPUT]: 验证目录只包含已配置连接、按名称排序并隔离单个模型目录失败
 * [POS]: assistant/model 的连接选择数据回归测试，不访问真实凭证或 Provider
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadAgentConnectionDirectory } from "@/features/assistant/model/agentConnectionDirectory";

const { getAgentCredentialStatus, getChatGptConnection, listAgentModels } = vi.hoisted(() => ({
  getAgentCredentialStatus: vi.fn(),
  getChatGptConnection: vi.fn(),
  listAgentModels: vi.fn(),
}));

vi.mock("@/features/assistant/model/agentRuntime", () => ({
  getAgentCredentialStatus,
  getChatGptConnection,
  listAgentModels,
}));

describe("agentConnectionDirectory", () => {
  beforeEach(() => {
    getChatGptConnection.mockResolvedValue({ connected: true, planType: "pro" });
    getAgentCredentialStatus.mockImplementation(async (provider: string) => ({
      provider,
      configured: provider === "deepseek-api" || provider === "kimi-api",
    }));
    listAgentModels.mockImplementation(async (provider: string) => {
      if (provider === "kimi-api") throw new Error("offline");
      return { fetchedAt: "", currentModel: "auto", currentReasoningEffort: "", models: [] };
    });
  });

  it("returns configured connections alphabetically and keeps a connection whose models cannot be read", async () => {
    const directory = await loadAgentConnectionDirectory();

    expect(directory.map((item) => item.label)).toEqual(["ChatGPT", "DeepSeek", "Kimi"]);
    expect(directory.find((item) => item.provider === "kimi-api")?.modelCatalog).toBeNull();
    expect(directory.some((item) => item.provider === "openai-api")).toBe(false);
  });
});
