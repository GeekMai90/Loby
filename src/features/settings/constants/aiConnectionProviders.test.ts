/**
 * [INPUT]: 依赖 Vitest 与 AI connection preset 目录
 * [OUTPUT]: 验证设置页只展示已支持服务商，且固定服务使用正确的官方 Endpoint
 * [POS]: settings constants 的连接预设回归测试，防止占位服务或错误计费地址重新进入表单
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { describe, expect, it } from "vitest";
import { API_CONNECTION_PRESETS } from "@/features/settings/constants/aiConnectionProviders";

describe("API_CONNECTION_PRESETS", () => {
  it("contains only supported API providers", () => {
    expect(API_CONNECTION_PRESETS.map((preset) => preset.label)).toEqual([
      "OpenAI",
      "Anthropic",
      "千问",
      "MiniMax",
      "DeepSeek",
      "Kimi",
      "自定义服务商",
    ]);
  });

  it("binds fixed providers to their official endpoints", () => {
    expect(Object.fromEntries(API_CONNECTION_PRESETS.map((preset) => [preset.provider, preset.endpoint]))).toMatchObject({
      "qwen-api": "https://dashscope.aliyuncs.com/compatible-mode/v1",
      "minimax-api": "https://api.minimaxi.com/v1",
      "deepseek-api": "https://api.deepseek.com",
      "kimi-api": "https://api.moonshot.cn/v1",
      "openai-compatible": "",
    });
  });
});
