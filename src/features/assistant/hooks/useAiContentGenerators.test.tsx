// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React DOM、Vitest、AI 内容模型/runtime mock 与 useAiContentGenerators
 * [OUTPUT]: 验证统一 runtime 参数、凭证门禁、三类请求映射及当前文稿实时正文覆盖
 * [POS]: assistant 一次性内容生成协调器的聚焦回归测试，防止 App 去重后 Provider 配置或正文来源分叉
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAiContentGenerators } from "@/features/assistant/hooks/useAiContentGenerators";
import type { WritingSheet } from "@/shared/types";

const { generateDocumentSummaryMock, generateImageSearchQueryMock, translateImageSearchQueryMock, resolveRuntimeMock } = vi.hoisted(() => ({
  generateDocumentSummaryMock: vi.fn(),
  generateImageSearchQueryMock: vi.fn(),
  translateImageSearchQueryMock: vi.fn(),
  resolveRuntimeMock: vi.fn(),
}));

vi.mock("@/features/assistant/model/documentSummary", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/features/assistant/model/documentSummary")>();
  return { ...original, generateDocumentSummary: generateDocumentSummaryMock };
});

vi.mock("@/features/assistant/model/imageSearchQuery", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/features/assistant/model/imageSearchQuery")>();
  return {
    ...original,
    generateImageSearchQuery: generateImageSearchQueryMock,
    translateImageSearchQuery: translateImageSearchQueryMock,
  };
});

vi.mock("@/features/assistant/model/agentRuntimeSettings", () => ({ resolveAgentRuntimeSettings: resolveRuntimeMock }));

const sheet: WritingSheet = {
  id: "sheet-ai-content",
  title: "AI 内容生成",
  body: "Saved body",
  tags: [],
  targetWords: 0,
  description: "",
  properties: {},
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

type GeneratorOptions = Parameters<typeof useAiContentGenerators>[0];

function GeneratorHarness(props: GeneratorOptions) {
  const generators = useAiContentGenerators(props);
  return createElement(
    "section",
    null,
    createElement("button", { "data-testid": "summary", onClick: () => void generators.documentSummaryGenerator?.(sheet) }, "summary"),
    createElement("button", { "data-testid": "image-query", onClick: () => void generators.imageSearchQueryGenerator?.(sheet) }, "query"),
    createElement(
      "button",
      { "data-testid": "translation", onClick: () => void generators.imageSearchQueryTranslator?.("安静的写作桌") },
      "translation",
    ),
    createElement(
      "output",
      { "data-testid": "availability" },
      [generators.documentSummaryGenerator, generators.imageSearchQueryGenerator, generators.imageSearchQueryTranslator]
        .map(Boolean)
        .join(","),
    ),
  );
}

describe("useAiContentGenerators", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    generateDocumentSummaryMock.mockReset().mockResolvedValue("摘要");
    generateImageSearchQueryMock.mockReset().mockResolvedValue("quiet writing desk");
    translateImageSearchQueryMock.mockReset().mockResolvedValue("quiet writing desk");
    resolveRuntimeMock.mockReset().mockReturnValue({
      model: "model-default",
      reasoningEffort: "medium",
      quickMode: true,
      baseUrl: "https://provider.example.com/v1",
    });
    container = document.createElement("div");
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
  });

  async function renderGenerators(overrides: Partial<GeneratorOptions> = {}) {
    const props: GeneratorOptions = {
      libraryPath: "/writing-library",
      provider: "openai-compatible",
      model: "model-default",
      reasoningEffort: "medium",
      quickMode: true,
      providerBaseUrl: "https://provider.example.com/v1",
      credentialStatus: { provider: "openai-compatible", configured: true },
      activeSheetId: sheet.id,
      readActiveEditorBody: () => "Live editor body",
      ...overrides,
    };
    await act(async () => root.render(createElement(GeneratorHarness, props)));
  }

  async function clickGenerator(testId: string) {
    await act(async () => {
      container.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`)?.click();
      await Promise.resolve();
    });
  }

  it("shares one runtime contract across summary, image query and translation requests", async () => {
    await renderGenerators();

    await clickGenerator("summary");
    await clickGenerator("image-query");
    await clickGenerator("translation");

    expect(resolveRuntimeMock).toHaveBeenCalledTimes(3);
    expect(resolveRuntimeMock).toHaveBeenNthCalledWith(
      1,
      "openai-compatible",
      "model-default",
      "medium",
      true,
      "https://provider.example.com/v1",
    );
    expect(generateDocumentSummaryMock).toHaveBeenCalledWith(
      expect.objectContaining({ libraryPath: "/writing-library", provider: "openai-compatible" }),
    );
    expect(generateImageSearchQueryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "openai-compatible",
        sheet: expect.objectContaining({ id: sheet.id, body: "Live editor body" }),
      }),
    );
    expect(translateImageSearchQueryMock).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "openai-compatible", query: "安静的写作桌" }),
    );
  });

  it("keeps saved content for non-active sheets and hides generators without matching credentials", async () => {
    await renderGenerators({ activeSheetId: "another-sheet" });
    await clickGenerator("image-query");
    expect(generateImageSearchQueryMock).toHaveBeenCalledWith(
      expect.objectContaining({ sheet: expect.objectContaining({ body: "Saved body" }) }),
    );

    await renderGenerators({ credentialStatus: { provider: "openai-api", configured: true } });
    expect(container.querySelector('[data-testid="availability"]')?.textContent).toBe("false,false,false");
  });
});
