// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React DOM、Vitest、Markdown 默认设置与 WritingSettingsPanel
 * [OUTPUT]: 验证写作设置选项、字体 Select 几何与 Markdown 格式化回调
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

  it("shows the five Markdown formatting choices and reports changes", async () => {
    const onMarkdownFormattingChange = vi.fn();
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        createElement(WritingSettingsPanel, {
          goalCelebrationEnabled: true,
          imageReferenceFormat: "markdown",
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
          onGoalCelebrationEnabledChange: vi.fn(),
          onImageReferenceFormatChange: vi.fn(),
          onEditorTypographyChange: vi.fn(),
          onMarkdownFormattingChange,
        }),
      );
    });

    expect(container.textContent).toContain("Markdown 排版");
    expect(container.textContent).not.toContain("专注模式");
    expect(container.textContent).not.toContain("打字机模式");
    expect(container.textContent).not.toContain("Markdown 预览");
    expect(container.textContent).toContain("清理多余空格");
    expect(container.textContent).toContain("统一段落空行");
    expect(container.textContent).toContain("规范 Markdown 标记");
    expect(container.textContent).toContain("中英文之间添加空格");
    expect(container.textContent).toContain("中文标点转为全角");
    expect(container.querySelector<HTMLElement>('[aria-label="图片引用"]')?.dataset.width).toBe("compact");
    expect(container.querySelector<HTMLElement>('[aria-label="字体"]')?.className).toContain("max-w-35");

    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="清理多余空格"]')?.click());
    expect(onMarkdownFormattingChange).toHaveBeenCalledWith({
      ...DEFAULT_MARKDOWN_FORMATTING_SETTINGS,
      cleanupWhitespace: false,
    });

    await act(async () => root.unmount());
  });
});
