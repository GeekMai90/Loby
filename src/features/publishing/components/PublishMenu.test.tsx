// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React DOM、Vitest、发布菜单与发布渠道契约
 * [OUTPUT]: 验证发布菜单触发器和微信公众号/墨问菜单项能够穿过 Portal 完成弹窗状态切换
 * [POS]: publishing 的菜单交互回归测试，保护 Windows 编辑器顶栏拖拽逻辑不吞掉发布动作
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { PublishMenu } from "@/features/publishing/components/PublishMenu";
import type { PublishChannelId } from "@/features/publishing/model/types";

function PublishMenuDialogHarness({
  onSelectChannel,
  onWindowDragStart,
}: {
  onSelectChannel: (channel: PublishChannelId, targetId?: string) => void;
  onWindowDragStart: () => void;
}) {
  const [selectedChannel, setSelectedChannel] = useState<PublishChannelId | null>(null);
  return (
    <>
      <header onMouseDown={onWindowDragStart}>
        <PublishMenu
          onSelectChannel={(channel, targetId) => {
            onSelectChannel(channel, targetId);
            setSelectedChannel(channel);
          }}
        />
      </header>
      <Dialog open={selectedChannel !== null} onOpenChange={(open) => !open && setSelectedChannel(null)}>
        {selectedChannel && (
          <DialogContent>
            <DialogTitle>{selectedChannel}</DialogTitle>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}

describe("PublishMenu", () => {
  let root: Root | null = null;

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  });

  afterEach(async () => {
    if (root) await act(async () => root?.unmount());
    root = null;
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  it.each([
    ["微信公众号", "wechat"],
    ["墨问笔记", "mowen"],
  ] as const)("opens from a pointer interaction and dispatches %s", async (label, channel) => {
    const onSelectChannel = vi.fn();
    const onWindowDragStart = vi.fn();
    const container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(createElement(PublishMenuDialogHarness, { onSelectChannel, onWindowDragStart }));
      await Promise.resolve();
    });

    const trigger = container.querySelector<HTMLButtonElement>("[data-slot='dropdown-menu-trigger']");
    expect(trigger?.dataset.noWindowDrag).toBe("true");

    await act(async () => {
      trigger?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerType: "mouse" }));
      await Promise.resolve();
    });

    const menuItem = [...document.body.querySelectorAll<HTMLElement>("[role='menuitem']")].find((item) => item.textContent === label);
    expect(menuItem).toBeDefined();
    expect(menuItem?.closest("[data-no-window-drag]")).not.toBeNull();

    await act(async () => {
      menuItem?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
      menuItem?.click();
      await Promise.resolve();
    });

    expect(onSelectChannel).toHaveBeenCalledWith(channel, undefined);
    // Portal 保留 React 组件树的事件冒泡；真实窗口拖拽处理器必须依靠 data-no-window-drag 判定并退出。
    expect(onWindowDragStart).toHaveBeenCalledOnce();
    expect(document.body.querySelector("[role='dialog']")?.textContent).toContain(channel);
  });
});
