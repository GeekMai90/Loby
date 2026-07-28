// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React DOM、Vitest、已配置连接目录与 AssistantModelSettingsMenu
 * [OUTPUT]: 验证当前对话模型按钮只显示品牌图标、紧凑版本名和真实推理强度
 * [POS]: assistant components 的 composer 模型选择器视觉信息密度回归测试
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantModelSettingsMenu } from "@/features/assistant/components/AssistantModelSettingsMenu";
import type { AgentConnectionDirectoryItem } from "@/features/assistant/model/agentConnectionDirectory";

const connections: AgentConnectionDirectoryItem[] = [
  {
    provider: "chatgpt-subscription",
    label: "ChatGPT",
    modelCatalog: {
      fetchedAt: "",
      currentModel: "gpt-5.6-sol",
      currentReasoningEffort: "high",
      models: [
        {
          slug: "gpt-5.6-sol",
          displayName: "GPT-5.6 Sol",
          description: "",
          contextWindowTokens: 400_000,
          supportsReasoning: true,
          defaultReasoningLevel: "medium",
          supportedReasoningLevels: ["low", "medium", "high"].map((effort) => ({ effort, description: effort })),
          additionalSpeedTiers: [],
          serviceTiers: [],
        },
      ],
    },
  },
];

describe("AssistantModelSettingsMenu", () => {
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

  it("renders a compact current-conversation label without repeating the connection name", () => {
    act(() => {
      root.render(
        createElement(AssistantModelSettingsMenu, {
          connections,
          agentProvider: "chatgpt-subscription",
          agentModel: "gpt-5.6-sol",
          agentReasoningEffort: "high",
          onSelectionChange: vi.fn(),
        }),
      );
    });

    const trigger = container.querySelector<HTMLButtonElement>("button");
    expect(trigger?.textContent).toContain("5.6 Sol高");
    expect(trigger?.textContent).not.toContain("ChatGPT");
    expect(trigger?.querySelector("[data-agent-provider-icon='chatgpt-subscription'] svg")).not.toBeNull();
  });
});
