// @vitest-environment happy-dom
// Covers the compact control choices and precise stepper interactions.

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WechatThemeBaseStyleChange } from "../lib/publishing/wechatThemeBaseStyle";
import { getWechatTheme } from "../lib/publishing/wechatThemes";
import { WechatThemeBaseStylePanel } from "./WechatThemeBaseStylePanel";

describe("WechatThemeBaseStylePanel", () => {
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

  it("uses precise steppers for measurements, compact color fields, and one perceptual slider", async () => {
    await renderPanel(root, vi.fn());

    expect(container.querySelectorAll('input[inputmode="decimal"]')).toHaveLength(11);
    expect(container.querySelectorAll('input[type="color"]')).toHaveLength(7);
    expect(container.querySelectorAll('[data-slot="slider"]')).toHaveLength(1);
    expect(container.querySelector('button[aria-label="减小正文"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="增大正文"]')).not.toBeNull();
    expect(container.querySelector('input[aria-label="正文"]')?.parentElement?.textContent).not.toContain("px");
    expect(container.textContent).not.toContain("调整会立即反映在预览中");
  });

  it("commits stepper buttons and keyboard arrow changes immediately", async () => {
    const onChange = vi.fn<(change: WechatThemeBaseStyleChange, commit: boolean) => void>();
    const baseStyle = getWechatTheme("loby-basic").baseStyle;
    await renderPanel(root, onChange);

    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="增大正文"]')!.click());
    expect(onChange).toHaveBeenLastCalledWith({ group: "typography", key: "bodySize", value: baseStyle.typography.bodySize + 1 }, true);

    const lineHeightInput = container.querySelector<HTMLInputElement>('input[aria-label="正文行高"]')!;
    await act(async () => lineHeightInput.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })));
    expect(onChange).toHaveBeenLastCalledWith({ group: "typography", key: "bodyLineHeight", value: 1.7 }, true);
  });
});

async function renderPanel(root: Root, onChange: (change: WechatThemeBaseStyleChange, commit: boolean) => void) {
  await act(async () => {
    root.render(
      createElement(WechatThemeBaseStylePanel, {
        baseStyle: getWechatTheme("loby-basic").baseStyle,
        onChange,
      }),
    );
  });
}
