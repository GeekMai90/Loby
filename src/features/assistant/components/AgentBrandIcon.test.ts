// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React DOM、Vitest 与 AgentBrandIcon 统一品牌映射
 * [OUTPUT]: 验证已支持 Provider 均输出行内 SVG，且 OpenAI/Kimi 保持跟随主题前景色的官方单色版
 * [POS]: assistant components 的 AI 连接品牌图标回归测试，防止连接列表与添加流程出现映射分叉
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentProviderIcon } from "@/features/assistant/components/AgentBrandIcon";
import type { AgentProvider } from "@/shared/types";

const PROVIDERS: AgentProvider[] = [
  "chatgpt-subscription",
  "openai-api",
  "anthropic-api",
  "qwen-api",
  "minimax-api",
  "deepseek-api",
  "kimi-api",
  "openai-compatible",
];

describe("AgentBrandIcon", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("renders one official or custom SVG for every supported provider", () => {
    act(() => {
      root.render(
        createElement(
          "div",
          null,
          PROVIDERS.map((provider) => createElement(AgentProviderIcon, { key: provider, provider })),
        ),
      );
    });

    for (const provider of PROVIDERS) {
      expect(container.querySelector(`[data-agent-provider-icon='${provider}'] svg`)).not.toBeNull();
    }
  });

  it("uses the theme-aware monochrome glyph for Kimi instead of its white color artwork", () => {
    act(() => root.render(createElement(AgentProviderIcon, { provider: "kimi-api" })));

    const kimiIcon = container.querySelector("[data-agent-provider-icon='kimi-api'] svg");
    expect(kimiIcon?.hasAttribute("color")).toBe(false);
    expect(kimiIcon?.querySelector("path[fill='#fff']")).toBeNull();
  });

  it("keeps the official OpenAI and Kimi monochrome icons instead of forcing brand fills", () => {
    act(() =>
      root.render(
        createElement("div", null, [
          createElement(AgentProviderIcon, { key: "openai", provider: "openai-api" }),
          createElement(AgentProviderIcon, { key: "kimi", provider: "kimi-api" }),
        ]),
      ),
    );

    expect(container.querySelector("[data-agent-provider-icon='openai-api'] svg")?.hasAttribute("color")).toBe(false);
    expect(container.querySelector("[data-agent-provider-icon='kimi-api'] svg")?.hasAttribute("color")).toBe(false);
  });
});
