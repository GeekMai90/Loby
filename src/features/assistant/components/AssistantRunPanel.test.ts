/**
 * [INPUT]: 依赖 React DOM、Vitest、AssistantRunPanel 与 agent run 公共契约
 * [OUTPUT]: 验证运行过程父级展开、结构化状态文案、暗色静止态透明弱化、子过程独立展开与历史终态活动收口
 * [POS]: assistant/components 的定向回归测试，保护运行时间线的状态语义与层级交互
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
    expect(panelToggle.className).toContain("dark:bg-transparent");
    expect(panelToggle.className).toContain("dark:text-[var(--foreground-tertiary)]");
    expect(panelToggle.className).toContain("dark:hover:text-foreground");
    expect(container.querySelector('[data-slot="assistant-run-details"]')).toBeNull();

    await act(async () => panelToggle.click());

    const activityToggle = container.querySelector<HTMLButtonElement>('[data-slot="assistant-run-activity"] button')!;
    const activity = container.querySelector<HTMLElement>('[data-slot="assistant-run-activity"]')!;
    expect(container.querySelector('[data-slot="assistant-run-details"]')).not.toBeNull();
    expect(activity.className).toContain("dark:text-[var(--foreground-tertiary)]");
    expect(activityToggle.getAttribute("aria-expanded")).toBe("false");
    expect(activityToggle.textContent).toContain("思路已整理");
    expect(activity.textContent).not.toContain("完成");
    expect(container.textContent).not.toContain("先确认现有组件结构");

    await act(async () => activityToggle.click());

    expect(activityToggle.getAttribute("aria-expanded")).toBe("true");
    expect(container.textContent).toContain("先确认现有组件结构");
    expect(container.textContent).toContain("rg assistant src");
    expect(container.textContent).toContain("找到相关组件");
  });

  it("becomes expandable as soon as an empty running reasoning step arrives", async () => {
    await act(async () =>
      root.render(
        createElement(AssistantRunPanel, {
          run: {
            status: "running",
            activities: [{ ...run.activities[0], status: "in_progress", command: "", output: "", text: "" }],
            usage: null,
          },
        }),
      ),
    );

    const panelToggle = container.querySelector<HTMLButtonElement>('button[aria-expanded="false"]')!;
    expect(panelToggle.disabled).toBe(false);
    expect(panelToggle.textContent).toContain("正在整理思路");

    await act(async () => panelToggle.click());
    expect(container.querySelector('[data-slot="assistant-run-details"]')?.textContent).toContain("整理思路");
  });

  it("does not leave child loaders visible after the parent run completed", async () => {
    await act(async () =>
      root.render(
        createElement(AssistantRunPanel, {
          run: {
            status: "completed",
            activities: [
              { ...run.activities[0], id: "reasoning-started", status: "in_progress" },
              { ...run.activities[0], id: "waiting-started", title: "等待处理", status: "running" },
            ],
            usage: null,
          },
        }),
      ),
    );

    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-expanded="false"]')!.click());

    expect(container.querySelector('[data-slot="assistant-run-details"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="assistant-run-details"] [data-slot="assistant-grid-loader"]')).toBeNull();
  });

  it("summarizes the authoritative active item instead of a stale activity row", async () => {
    await act(async () =>
      root.render(
        createElement(AssistantRunPanel, {
          run: {
            schemaVersion: 2,
            status: "running",
            phase: "executingTool",
            activeActivityId: "image",
            activities: [
              { ...run.activities[0], id: "response", kind: "modelResponse", state: "running", title: "生成回复", status: "in_progress" },
              {
                ...run.activities[0],
                id: "image",
                kind: "imageGeneration",
                state: "running",
                title: "调用 generate_image",
                status: "in_progress",
              },
            ],
            usage: null,
          },
        }),
      ),
    );

    expect(container.querySelector<HTMLButtonElement>('[data-slot="assistant-run-panel"] > button')?.textContent).toContain("正在生成图片");
  });
});
