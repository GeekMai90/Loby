// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React DOM、Vitest 与 AssistantStaticMessage
 * [OUTPUT]: 验证普通系统通知使用透明表面和思考详情同款左侧竖线
 * [POS]: assistant/components 的消息表面视觉回归测试，防止系统通知重新长出独立卡片
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantStaticMessage } from "@/features/assistant/components/AssistantMessageSurface";

describe("AssistantStaticMessage system notice", () => {
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
    vi.unstubAllGlobals();
  });

  it("renders an error notice without a card and with the shared vertical timeline", () => {
    act(() => {
      root.render(
        createElement(AssistantStaticMessage, {
          role: "assistant",
          content: "请先选择一篇文稿。",
          error: true,
        }),
      );
    });

    const message = container.querySelector<HTMLElement>('[data-slot="assistant-message"]')!;
    const body = container.querySelector<HTMLElement>('[data-slot="assistant-message-body"]')!;
    expect(message.className).toContain("bg-transparent");
    expect(message.className).not.toContain("bg-muted/40");
    expect(message.className).not.toContain("bg-destructive/6");
    expect(body.className).toContain("border-l");
  });
});
