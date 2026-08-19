// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React DOM、Vitest 与 KeyboardShortcutsDialogHost
 * [OUTPUT]: 验证快捷键浏览 surface 只在打开时加载，并保留关闭回调
 * [POS]: settings shortcut surface host 的聚焦回归测试，保护 lazy 迁移不改变菜单入口契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KeyboardShortcutsDialogHost } from "@/features/settings/components/KeyboardShortcutsDialogHost";

vi.mock("@/features/settings/components/KeyboardShortcutsDialog", () => ({
  KeyboardShortcutsDialog: ({ onClose }: { onClose: () => void }) =>
    createElement("button", { "data-testid": "keyboard-shortcuts-dialog", onClick: onClose }, "快捷键"),
}));

describe("KeyboardShortcutsDialogHost", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.replaceChildren();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  async function renderHost(open: boolean, onClose = vi.fn()) {
    await act(async () => {
      root.render(createElement(KeyboardShortcutsDialogHost, { open, onClose }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    return onClose;
  }

  it("does not mount while the shortcut surface is closed", async () => {
    await renderHost(false);
    expect(document.body.querySelector('[data-testid="keyboard-shortcuts-dialog"]')).toBeNull();
  });

  it("passes the close callback to the lazy surface", async () => {
    const onClose = await renderHost(true);
    document.body.querySelector<HTMLButtonElement>('[data-testid="keyboard-shortcuts-dialog"]')?.click();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
