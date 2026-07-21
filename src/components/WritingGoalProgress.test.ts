import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WritingGoalProgress } from "./WritingGoalProgress";

describe("WritingGoalProgress", () => {
  it("renders a toolbar-sized liquid-glass progress ring", () => {
    const html = renderToStaticMarkup(
      React.createElement(WritingGoalProgress, {
        sheetId: "sheet-1",
        wordCount: 500,
        targetWords: 1000,
      }),
    );

    expect(html).toContain("writing-goal-progress-trigger");
    expect(html).toContain("assistant-launcher");
    expect(html).toContain("size-10");
    expect(html).toContain("assistant-launcher-glass writing-goal-progress-glass");
    expect(html).toContain("writing-goal-progress-reservoir");
    expect(html).toContain("writing-goal-progress-fill");
    expect(html).toContain("assistant-launcher-fluid writing-goal-progress-fluid");
    expect(html).toContain("--writing-goal-progress:50%");
    expect(html).not.toContain("<svg");
    expect(html).toContain("完成 50%");
    expect(html).toContain(">500</span>");
    expect(html).not.toContain("<button");
  });

  it("keeps the same circular control when no goal is set", () => {
    const html = renderToStaticMarkup(
      React.createElement(WritingGoalProgress, {
        sheetId: "sheet-1",
        wordCount: 24,
        targetWords: 0,
      }),
    );

    expect(html).toContain("writing-goal-progress-trigger");
    expect(html).toContain("当前文稿 24 字");
    expect(html).toContain("--writing-goal-progress:0%");
  });

  it("exposes progressively stronger states near the writing goal", () => {
    const renderAt = (wordCount: number) =>
      renderToStaticMarkup(
        React.createElement(WritingGoalProgress, {
          sheetId: "sheet-1",
          wordCount,
          targetWords: 1000,
        }),
      );

    expect(renderAt(849)).toContain('data-goal-state="active"');
    expect(renderAt(850)).toContain('data-goal-state="near"');
    expect(renderAt(950)).toContain('data-goal-state="final"');
    expect(renderAt(1000)).toContain('data-goal-state="complete"');
  });
});
