/**
 * [INPUT]: 依赖 React DOM、Vitest 与 useLibraryRailPeek
 * [OUTPUT]: 验证导航栏临时唤出、跨区域停留、延迟收回、浮层占用与 Escape 关闭契约
 * [POS]: 写作库 feature 的悬浮导航回归测试，保护临时预览不污染正式展开状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LIBRARY_RAIL_PEEK_CLOSE_DELAY_MS,
  LIBRARY_RAIL_PEEK_NATIVE_EDGE_MAX_X,
  LIBRARY_RAIL_PEEK_OPEN_DELAY_MS,
  useLibraryRailPeek,
} from "@/features/library/hooks/useLibraryRailPeek";

function PeekHarness({ hasOpenOverlay = () => false }: { hasOpenOverlay?: () => boolean }) {
  const peek = useLibraryRailPeek({ enabled: true, hasOpenOverlay });
  return createElement(
    "div",
    null,
    createElement("button", {
      "data-testid": "trigger",
      onPointerEnter: peek.onTriggerPointerEnter,
      onPointerLeave: peek.onTriggerPointerLeave,
    }),
    createElement("aside", {
      "data-testid": "rail",
      onPointerEnter: peek.onRailPointerEnter,
      onPointerLeave: peek.onRailPointerLeave,
    }),
    createElement("output", { "data-testid": "state" }, peek.open ? "open" : "closed"),
  );
}

describe("useLibraryRailPeek", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  async function renderHarness(hasOpenOverlay?: () => boolean) {
    await act(async () => root.render(createElement(PeekHarness, { hasOpenOverlay })));
    return {
      rail: container.querySelector<HTMLElement>('[data-testid="rail"]')!,
      state: container.querySelector<HTMLOutputElement>('[data-testid="state"]')!,
      trigger: container.querySelector<HTMLButtonElement>('[data-testid="trigger"]')!,
    };
  }

  it("opens only after the edge hover delay", async () => {
    const { state, trigger } = await renderHarness();
    await act(async () => trigger.dispatchEvent(pointerEvent("pointerover")));
    await act(async () => vi.advanceTimersByTime(LIBRARY_RAIL_PEEK_OPEN_DELAY_MS - 1));
    expect(state.textContent).toBe("closed");
    await act(async () => vi.advanceTimersByTime(1));
    expect(state.textContent).toBe("open");
  });

  it("keeps the pending reveal when the pointer enters the native window edge", async () => {
    const { state, trigger } = await renderHarness();
    await act(async () => {
      trigger.dispatchEvent(pointerEvent("pointerover"));
      trigger.dispatchEvent(pointerEvent("pointerout", { clientX: LIBRARY_RAIL_PEEK_NATIVE_EDGE_MAX_X, clientY: 120 }));
    });
    await act(async () => vi.advanceTimersByTime(LIBRARY_RAIL_PEEK_OPEN_DELAY_MS));
    expect(state.textContent).toBe("open");
  });

  it("bridges the trigger and rail before closing after the leave delay", async () => {
    const { rail, state, trigger } = await renderHarness();
    await act(async () => trigger.dispatchEvent(pointerEvent("pointerover")));
    await act(async () => vi.advanceTimersByTime(LIBRARY_RAIL_PEEK_OPEN_DELAY_MS));
    await act(async () => {
      trigger.dispatchEvent(pointerEvent("pointerout", { relatedTarget: rail }));
      rail.dispatchEvent(pointerEvent("pointerover", { relatedTarget: trigger }));
    });
    await act(async () => vi.advanceTimersByTime(LIBRARY_RAIL_PEEK_CLOSE_DELAY_MS));
    expect(state.textContent).toBe("open");

    await act(async () => rail.dispatchEvent(pointerEvent("pointerout")));
    await act(async () => vi.advanceTimersByTime(LIBRARY_RAIL_PEEK_CLOSE_DELAY_MS - 1));
    expect(state.textContent).toBe("open");
    await act(async () => vi.advanceTimersByTime(1));
    expect(state.textContent).toBe("closed");
  });

  it("waits for a rail-owned overlay to close and supports immediate Escape", async () => {
    let overlayOpen = true;
    const { rail, state, trigger } = await renderHarness(() => overlayOpen);
    await act(async () => trigger.dispatchEvent(pointerEvent("pointerover")));
    await act(async () => vi.advanceTimersByTime(LIBRARY_RAIL_PEEK_OPEN_DELAY_MS));
    await act(async () => {
      trigger.dispatchEvent(pointerEvent("pointerout"));
      rail.dispatchEvent(pointerEvent("pointerout"));
    });
    await act(async () => vi.advanceTimersByTime(LIBRARY_RAIL_PEEK_CLOSE_DELAY_MS));
    expect(state.textContent).toBe("open");

    overlayOpen = false;
    await act(async () => vi.advanceTimersByTime(LIBRARY_RAIL_PEEK_CLOSE_DELAY_MS));
    expect(state.textContent).toBe("closed");

    await act(async () => trigger.dispatchEvent(pointerEvent("pointerover")));
    await act(async () => vi.advanceTimersByTime(LIBRARY_RAIL_PEEK_OPEN_DELAY_MS));
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    expect(state.textContent).toBe("closed");
  });
});

function pointerEvent(type: string, init: PointerEventInit = {}): PointerEvent {
  return new PointerEvent(type, { bubbles: true, ...init });
}
