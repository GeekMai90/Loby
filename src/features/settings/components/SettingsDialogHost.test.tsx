// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React DOM、Vitest 与 SettingsDialogHost
 * [OUTPUT]: 验证设置 surface 只在打开时加载，并把初始 tab 传给实际 SettingsDialog
 * [POS]: settings lazy host 的聚焦回归测试，保护 App 拆分后设置入口和 tab 上下文不丢失
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsDialogHost, type SettingsDialogHostProps } from "@/features/settings/components/SettingsDialogHost";

vi.mock("@/features/settings/components/SettingsDialog", () => ({
  SettingsDialog: ({ initialTab }: { initialTab?: string }) =>
    createElement("div", { "data-testid": "settings-dialog" }, initialTab ?? "appearance"),
}));

function createProps(overrides: Partial<SettingsDialogHostProps> = {}): SettingsDialogHostProps {
  return { open: true, initialTab: "appearance", ...overrides } as SettingsDialogHostProps;
}

describe("SettingsDialogHost", () => {
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

  async function renderHost(props: SettingsDialogHostProps) {
    await act(async () => {
      root.render(createElement(SettingsDialogHost, props));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  it("does not mount the lazy surface while settings is closed", async () => {
    await renderHost(createProps({ open: false }));
    expect(document.body.querySelector('[data-testid="settings-dialog"]')).toBeNull();
  });

  it("passes the requested initial tab to the lazy surface", async () => {
    await renderHost(createProps({ initialTab: "publishing" }));
    expect(document.body.querySelector('[data-testid="settings-dialog"]')?.textContent).toBe("publishing");
  });
});
