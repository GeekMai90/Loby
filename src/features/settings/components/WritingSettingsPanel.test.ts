// @vitest-environment happy-dom

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
          focusMode: false,
          typewriterMode: false,
          goalCelebrationEnabled: true,
          sheetPreviewMode: false,
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
          onFocusModeChange: vi.fn(),
          onTypewriterModeChange: vi.fn(),
          onGoalCelebrationEnabledChange: vi.fn(),
          onSheetPreviewModeChange: vi.fn(),
          onImageReferenceFormatChange: vi.fn(),
          onEditorTypographyChange: vi.fn(),
          onMarkdownFormattingChange,
        }),
      );
    });

    expect(container.textContent).toContain("Markdown 排版");
    expect(container.textContent).toContain("清理多余空格");
    expect(container.textContent).toContain("统一段落空行");
    expect(container.textContent).toContain("规范 Markdown 标记");
    expect(container.textContent).toContain("中英文之间添加空格");
    expect(container.textContent).toContain("中文标点转为全角");

    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="清理多余空格"]')?.click());
    expect(onMarkdownFormattingChange).toHaveBeenCalledWith({
      ...DEFAULT_MARKDOWN_FORMATTING_SETTINGS,
      cleanupWhitespace: false,
    });

    await act(async () => root.unmount());
  });
});
