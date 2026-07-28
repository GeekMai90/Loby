/**
 * [INPUT]: 依赖 Vitest 与 agentConnectionCapabilities
 * [OUTPUT]: 验证连接能力目录只声明真实接入的对话、思考和图片能力
 * [POS]: AI 助手连接能力的回归测试，防止兼容 Provider 被按名称误判为支持高级协议
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { describe, expect, it } from "vitest";
import { agentConnectionCapabilities } from "@/features/assistant/model/agentConnectionCapabilities";

describe("agentConnectionCapabilities", () => {
  it("exposes image generation only for implemented image adapters", () => {
    expect(agentConnectionCapabilities("chatgpt-subscription")).toContain("imageGeneration");
    expect(agentConnectionCapabilities("openai-api")).toContain("imageGeneration");
    expect(agentConnectionCapabilities("anthropic-api")).not.toContain("imageGeneration");
    expect(agentConnectionCapabilities("qwen-api")).toEqual(["text", "reasoning"]);
    expect(agentConnectionCapabilities("minimax-api")).toEqual(["text", "reasoning"]);
    expect(agentConnectionCapabilities("deepseek-api")).toEqual(["text", "reasoning"]);
    expect(agentConnectionCapabilities("kimi-api")).toEqual(["text", "reasoning"]);
    expect(agentConnectionCapabilities("openai-compatible")).toEqual(["text"]);
  });
});
