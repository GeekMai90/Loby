// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React DOM、Vitest、Markdown 默认设置与 WritingSettingsPanel
 * [OUTPUT]: 验证写作设置“通用”分组、在线图片 AI 推荐、已退役图片格式选项、字体 Select 几何与 Markdown 格式化回调
 * [POS]: settings 的写作面板回归测试，保护设置项呈现和交互契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_MARKDOWN_FORMATTING_SETTINGS } from "@/features/editor/model/markdownFormattingSettings";
import { WritingSettingsPanel } from "@/features/settings/components/WritingSettingsPanel";

describe("WritingSettingsPanel", () => {
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  });

  afterEach(() => {
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  it("shows Markdown Chinese typography choices and reports changes", async () => {
    const onMarkdownFormattingChange = vi.fn();
    const onInboxTargetWordsChange = vi.fn();
    const onUnsplashAiRecommendationEnabledChange = vi.fn();
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        createElement(WritingSettingsPanel, {
          inboxTargetWords: 1000,
          goalCelebrationEnabled: true,
          unsplashAiRecommendationEnabled: true,
          unsplashSearchTranslationEnabled: false,
          unsplashSearchTranslationProvider: "ai",
          editorTypography: {
            fontPreset: "system",
            customFontFamily: "",
            lineHeight: 1.76,
            paragraphSpacing: 0,
            bodyFontSize: 18,
            h1FontSize: 30,
            h2FontSize: 26,
            h3FontSize: 22,
            tableFontSize: 15,
          },
          markdownFormatting: DEFAULT_MARKDOWN_FORMATTING_SETTINGS,
          onInboxTargetWordsChange,
          onGoalCelebrationEnabledChange: vi.fn(),
          onUnsplashAiRecommendationEnabledChange,
          onUnsplashSearchTranslationEnabledChange: vi.fn(),
          onUnsplashSearchTranslationProviderChange: vi.fn(),
          onEditorTypographyChange: vi.fn(),
          onMarkdownFormattingChange,
        }),
      );
    });

    expect(container.textContent).toContain("Markdown 中文排版优化");
    expect(container.textContent).not.toContain("专注模式");
    expect(container.textContent).not.toContain("打字机模式");
    expect(container.textContent).not.toContain("Markdown 预览");
    expect(container.textContent).toContain("保存时进行中文排版优化");
    expect(container.textContent).toContain("收件箱默认目标字数");
    expect(container.textContent).toContain("使用 AI 推荐搜索词");
    expect(container.textContent).toContain("中文搜索词自动翻译");
    expect(container.textContent?.indexOf("收件箱默认目标字数")).toBeLessThan(container.textContent?.indexOf("目标达成礼花") ?? -1);
    expect(
      container.querySelector<HTMLButtonElement>('[aria-label="保存时进行中文排版优化"]')?.closest("section")?.querySelector("h4")
        ?.textContent,
    ).toBe("通用");
    expect(container.textContent).toContain("清理多余空格");
    expect(container.textContent).toContain("统一段落空行");
    expect(container.textContent).toContain("规范 Markdown 标记");
    expect(container.textContent).toContain("中英文之间添加空格");
    expect(container.textContent).toContain("中文标点转为全角");
    expect(container.textContent).not.toContain("图片引用");
    expect(container.querySelector<HTMLElement>('[aria-label="字体"]')?.dataset.width).toBe("fit");

    const inboxTargetInput = container.querySelector<HTMLInputElement>('[aria-label="收件箱默认目标字数"]');
    expect(inboxTargetInput?.value).toBe("1000");
    await act(async () => {
      if (!inboxTargetInput) return;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(inboxTargetInput, "1600");
      inboxTargetInput.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(onInboxTargetWordsChange).toHaveBeenCalledWith(1600);

    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="保存时进行中文排版优化"]')?.click());
    expect(onMarkdownFormattingChange).toHaveBeenCalledWith({
      ...DEFAULT_MARKDOWN_FORMATTING_SETTINGS,
      formatOnSave: true,
    });

    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="清理多余空格"]')?.click());
    expect(onMarkdownFormattingChange).toHaveBeenCalledWith({
      ...DEFAULT_MARKDOWN_FORMATTING_SETTINGS,
      cleanupWhitespace: false,
    });

    await act(async () => root.unmount());
  });
});
