// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React DOM、Vitest、AiSettingsPanel 与 quick prompt 上限契约
 * [OUTPUT]: 验证 AI 设置页默认模型能力、快捷提示/Skills 二级导航与服务配置
 * [POS]: settings 的 AI 面板回归测试，防止默认连接、可增长列表与服务凭证重新挤在同一页面
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentModelCatalog, AiQuickPrompt } from "@/shared/types";
import { MAX_AI_QUICK_PROMPTS } from "@/features/assistant/model/quickPrompts";
import { AiSettingsPanel } from "@/features/settings/components/AiSettingsPanel";

describe("AiSettingsPanel secondary settings pages", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    localStorage.clear();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("opens the prompt list as a secondary page and returns to the AI settings home", async () => {
    const prompts = Array.from({ length: MAX_AI_QUICK_PROMPTS }, (_, index) => quickPrompt(index));
    await act(async () => root.render(createElement(AiSettingsPanel, panelProps(prompts))));

    expect(container.textContent).toContain(`已创建 ${MAX_AI_QUICK_PROMPTS}/${MAX_AI_QUICK_PROMPTS} 条`);
    expect(container.textContent).not.toContain("提示 1");
    expect(container.textContent).toContain("默认");
    expect(container.textContent).toContain("连接");
    expect(container.textContent).toContain("模型");
    expect(container.textContent).toContain("思考");
    expect(container.textContent).toContain("生图");
    expect(container.textContent).toContain("发送");
    expect(container.querySelector("[aria-label='连接'] [data-agent-provider-icon]")).toBeNull();
    expect(container.querySelector("[aria-label='模型'] [data-agent-provider-icon]")).toBeNull();
    expect(container.textContent).not.toContain("OpenAI 图片 API Key");
    expect(container.textContent).not.toContain("图片 API");
    expect(container.textContent).not.toContain("MCP");
    expect(container.textContent).not.toContain("Streamable HTTP");
    expect(
      ["连接", "模型", "思考", "生图", "发送"].map(
        (label) => container.querySelector<HTMLElement>(`[aria-label='${label}']`)?.dataset.width,
      ),
    ).toEqual(["fit", "fit", "fit", "fit", "fit"]);
    expect(container.textContent).not.toContain("默认形态");
    expect(container.textContent).not.toContain("跟随窗口大小");

    const promptEntry = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("我的提示"));
    await act(async () => promptEntry?.click());

    expect(container.textContent).toContain("提示 1");
    expect(container.textContent).not.toContain("默认");
    const createButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("新建"));
    expect(createButton?.disabled).toBe(true);

    const backButton = container.querySelector<HTMLButtonElement>("[aria-label='返回 AI 助手设置']");
    await act(async () => backButton?.click());

    expect(container.textContent).toContain("默认");
    expect(container.textContent).not.toContain("提示 1");
  });

  it("shows a truthful unsupported state when the selected model has no reasoning control", async () => {
    const modelCatalog: AgentModelCatalog = {
      fetchedAt: "",
      currentModel: "custom",
      currentReasoningEffort: "",
      models: [
        {
          slug: "custom",
          displayName: "DeepSeek Chat",
          description: "兼容服务模型",
          contextWindowTokens: 64_000,
          supportsReasoning: false,
          defaultReasoningLevel: "",
          supportedReasoningLevels: [],
          additionalSpeedTiers: [],
          serviceTiers: [],
        },
      ],
    };
    await act(async () =>
      root.render(
        createElement(AiSettingsPanel, {
          ...panelProps([]),
          agentProvider: "openai-compatible",
          agentModel: "custom",
          agentReasoningEffort: "",
          modelCatalog,
        }),
      ),
    );

    expect(container.textContent).toContain("DeepSeek Chat");
    expect(container.textContent).toContain("当前模型不支持");
  });

  it("shows connection management as an added-service list with one add menu", async () => {
    await act(async () => {
      root.render(createElement(AiSettingsPanel, panelProps([])));
      await Promise.resolve();
    });

    expect(container.textContent).not.toContain("管理 AI 提供商连接。");
    expect(container.textContent).toContain("添加连接");
    expect(container.textContent).not.toContain("连接配置");
    expect(container.textContent).not.toContain("凭证状态");

    const addButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("添加连接"));
    await act(async () => {
      addButton?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0 }));
      await Promise.resolve();
    });

    expect(document.body.textContent).toContain("ChatGPT 订阅");
    expect(document.body.textContent).not.toContain("Claude 订阅");
    expect(document.body.textContent).toContain("其他提供商");

    const otherProviders = Array.from(document.body.querySelectorAll<HTMLElement>("[role='menuitem']")).find((item) =>
      item.textContent?.includes("其他提供商"),
    );
    await act(async () => {
      otherProviders?.click();
      await Promise.resolve();
    });

    expect(document.body.textContent).toContain("API 配置");
    expect(document.body.textContent).not.toContain("选择已支持的服务商并填写 API Key");

    const secretInput = document.body.querySelector<HTMLInputElement>("input[type='password']");
    expect(secretInput).not.toBeNull();
    const revealButton = document.body.querySelector<HTMLButtonElement>("[aria-label='显示 API Key']");
    await act(async () => revealButton?.click());
    expect(document.body.querySelector<HTMLInputElement>("input[placeholder='输入 API Key']")?.type).toBe("text");
    expect(document.body.querySelector("[aria-label='隐藏 API Key']")).not.toBeNull();

    const endpointInput = document.body.querySelector<HTMLInputElement>("[aria-label='Endpoint']");
    expect(endpointInput?.value).toBe("https://api.openai.com/v1");
    expect(endpointInput?.disabled).toBe(true);
  });

  it("opens Skills management as a secondary page and returns to the AI settings home", async () => {
    await act(async () => {
      root.render(createElement(AiSettingsPanel, panelProps([])));
      await Promise.resolve();
    });

    const skillsEntry = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("我的技能"));
    await act(async () => skillsEntry?.click());

    expect(container.textContent).toContain("Skills");
    expect(container.textContent).toContain("打开目录");
    expect(container.textContent).toContain("导入");
    expect(container.textContent).not.toContain("默认");

    const backButton = container.querySelector<HTMLButtonElement>("[aria-label='返回 AI 助手设置']");
    await act(async () => backButton?.click());

    expect(container.textContent).toContain("默认");
    expect(container.textContent).not.toContain("打开目录");
  });
});

function panelProps(quickPrompts: AiQuickPrompt[]) {
  return {
    libraryPath: "browser://library",
    assistantSendMode: "enter" as const,
    agentProvider: "openai-api" as const,
    providerBaseUrl: "",
    agentModel: "gpt-5.6-terra",
    agentReasoningEffort: "medium",
    modelCatalog: defaultModelCatalog(),
    quickPrompts,
    quickPromptsReady: true,
    onAssistantSendModeChange: vi.fn(),
    onAgentProviderChange: vi.fn(),
    onProviderBaseUrlChange: vi.fn(),
    onAgentModelChange: vi.fn(),
    onAgentReasoningEffortChange: vi.fn(),
    onAddQuickPrompt: vi.fn(),
    onEditQuickPrompt: vi.fn(),
    onDeleteQuickPrompt: vi.fn(),
    onMoveQuickPrompt: vi.fn(),
  };
}

function defaultModelCatalog(): AgentModelCatalog {
  return {
    fetchedAt: "",
    currentModel: "gpt-5.6-terra",
    currentReasoningEffort: "medium",
    models: [
      {
        slug: "gpt-5.6-terra",
        displayName: "GPT-5.6 Terra",
        description: "质量、速度与成本平衡",
        contextWindowTokens: 128_000,
        supportsReasoning: true,
        defaultReasoningLevel: "medium",
        supportedReasoningLevels: ["low", "medium", "high"].map((effort) => ({ effort, description: effort })),
        additionalSpeedTiers: ["priority"],
        serviceTiers: [],
      },
    ],
  };
}

function quickPrompt(index: number): AiQuickPrompt {
  return {
    id: `prompt-${index}`,
    title: `提示 ${index + 1}`,
    content: `提示内容 ${index + 1}`,
    createdAt: "2026-07-19T00:00:00.000Z",
    updatedAt: "2026-07-19T00:00:00.000Z",
  };
}
