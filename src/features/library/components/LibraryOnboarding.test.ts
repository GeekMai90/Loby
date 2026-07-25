// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 Vitest、React DOM 与 LibraryOnboarding
 * [OUTPUT]: 验证首次设置和帮助菜单回看模式不会混用写作文件夹操作
 * [POS]: 写作库欢迎界面的行为边界回归测试，保护单写作文件夹产品模型
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LibraryOnboarding } from "@/features/library/components/LibraryOnboarding";

describe("LibraryOnboarding", () => {
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
    vi.unstubAllGlobals();
  });

  it("keeps writing-folder setup actions in first-run mode", async () => {
    await act(async () =>
      root.render(
        createElement(LibraryOnboarding, {
          defaultParentPath: "/Users/example/Documents",
          onChooseParent: vi.fn().mockResolvedValue(null),
          onCreateLibrary: vi.fn().mockResolvedValue(undefined),
          onOpenExistingLibrary: vi.fn().mockResolvedValue(undefined),
        }),
      ),
    );

    expect(document.body.textContent).toContain("写作文件夹名称");
    expect(document.body.textContent).toContain("开始写作");
    expect(document.body.textContent).toContain("打开已有写作文件夹");
    expect(document.body.textContent).not.toContain("继续写作");
  });

  it("replays the welcome screen without exposing writing-folder management", async () => {
    const onDismiss = vi.fn();
    await act(async () => root.render(createElement(LibraryOnboarding, { mode: "welcome", onDismiss })));

    expect(document.body.textContent).toContain("欢迎来到落笔");
    expect(document.body.textContent).toContain("继续写作");
    expect(document.body.textContent).not.toContain("写作文件夹名称");
    expect(document.body.textContent).not.toContain("打开已有写作文件夹");

    const closeButton = document.body.querySelector<HTMLButtonElement>('button[aria-label="关闭欢迎界面"]');
    expect(closeButton?.dataset.slot).toBe("button");
    expect(closeButton?.dataset.variant).toBe("ghost");
    expect(closeButton?.dataset.size).toBe("icon-sm");
    expect(closeButton?.className).toContain("z-30");
    expect(closeButton?.className).toContain("[-webkit-app-region:no-drag]");
    await act(async () => closeButton?.click());
    expect(onDismiss).toHaveBeenCalledOnce();

    onDismiss.mockClear();
    const continueButton = Array.from(document.body.querySelectorAll("button")).find((button) => button.textContent === "继续写作");
    expect(continueButton).toBeDefined();
    await act(async () => continueButton?.click());
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
