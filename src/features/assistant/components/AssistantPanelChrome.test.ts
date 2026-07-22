import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AssistantPanelHeaderFrame } from "@/features/assistant/components/AssistantPanelChrome";

describe("AssistantPanelHeaderFrame", () => {
  it("uses the shared panel gutter without compensating offsets", () => {
    const html = renderToStaticMarkup(createElement(AssistantPanelHeaderFrame, { title: "新对话" }));

    expect(html).toContain("inset-x-0");
    expect(html).toContain("px-[var(--assistant-panel-gutter)]");
    expect(html).toContain("grid-cols-[80px_minmax(0,1fr)_80px]");
    expect(html).toContain("w-20");
    expect(html).not.toContain("132px");
    expect(html).not.toContain("w-33");
    expect(html).not.toContain("right-[-8px]");
    expect(html).not.toContain("left-[-8px]");
  });
});
