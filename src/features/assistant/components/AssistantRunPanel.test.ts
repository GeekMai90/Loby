/**
 * [INPUT]: 依赖 React DOM、Vitest、AssistantRunPanel 与 agent run 公共契约
 * [OUTPUT]: 验证思考过程父级展开与子过程默认折叠、独立展开的交互边界
 * [POS]: assistant/components 的定向回归测试，保护思考过程时间线的层级交互
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantRunPanel } from "@/features/assistant/components/AssistantRunPanel";
import type { AgentRunInfo } from "@/shared/types";

const run: AgentRunInfo = {
  status: "completed",
  activities: [
    {
      id: "activity-1",
      rawType: "item/reasoning",
      title: "思考过程",
      status: "completed",
      command: "rg assistant src",
      output: "找到相关组件",
      text: "先确认现有组件结构",
      exitCode: 0,
    },
  ],
  usage: null,
};

describe("AssistantRunPanel", () => {
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
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("keeps every activity collapsed until its own title toggle is opened", async () => {
    await act(async () => root.render(createElement(AssistantRunPanel, { run })));

    const panelToggle = container.querySelector<HTMLButtonElement>('button[aria-expanded="false"]')!;
    expect(container.querySelector('[data-slot="assistant-run-details"]')).toBeNull();

    await act(async () => panelToggle.click());

    const activityToggle = container.querySelector<HTMLButtonElement>('[data-slot="assistant-run-activity"] button')!;
    const activity = container.querySelector<HTMLElement>('[data-slot="assistant-run-activity"]')!;
    expect(container.querySelector('[data-slot="assistant-run-details"]')).not.toBeNull();
    expect(activityToggle.getAttribute("aria-expanded")).toBe("false");
    expect(activityToggle.textContent).toContain("整理思路");
    expect(activity.textContent).not.toContain("完成");
    expect(container.textContent).not.toContain("先确认现有组件结构");

    await act(async () => activityToggle.click());

    expect(activityToggle.getAttribute("aria-expanded")).toBe("true");
    expect(container.textContent).toContain("先确认现有组件结构");
    expect(container.textContent).toContain("rg assistant src");
    expect(container.textContent).toContain("找到相关组件");
  });
});
