import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WritingGoalProgress } from "./WritingGoalProgress";

describe("WritingGoalProgress", () => {
  it("renders a toolbar-sized liquid-glass progress ring", () => {
    const html = renderToStaticMarkup(
      React.createElement(WritingGoalProgress, {
        wordCount: 500,
        targetWords: 1000,
      }),
    );

    expect(html).toContain("writing-goal-progress-trigger");
    expect(html).toContain("size-[38px]");
    expect(html).toContain("完成 50%");
    expect(html).toContain(">500</span>");
    expect(html).not.toContain("<button");
  });

  it("keeps the same circular control when no goal is set", () => {
    const html = renderToStaticMarkup(
      React.createElement(WritingGoalProgress, {
        wordCount: 24,
        targetWords: 0,
      }),
    );

    expect(html).toContain("writing-goal-progress-trigger");
    expect(html).toContain("当前文稿 24 字");
    expect(html).not.toContain("writing-goal-ring-progress transition");
  });
});
