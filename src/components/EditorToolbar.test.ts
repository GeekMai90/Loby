import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { EditorToolbar } from "./EditorToolbar";

describe("EditorToolbar", () => {
  it("keeps only the focus-mode exit action visible while focus mode is active", () => {
    const handler = vi.fn();
    const html = renderToStaticMarkup(
      createElement(EditorToolbar, {
        inspectorOpen: true,
        focusMode: true,
        leftSidebarHidden: false,
        canNavigateBack: true,
        canNavigateForward: true,
        canPublish: true,
        onExpandLeftSidebar: handler,
        onToggleFocusMode: handler,
        onNavigateBack: handler,
        onNavigateForward: handler,
        onToggleInspector: handler,
        onSelectPublishChannel: handler,
        onWindowToolbarDoubleClick: handler,
      }),
    );

    expect(html).toContain("退出专注模式");
    expect(html).not.toContain("文稿前后导航");
    expect(html).not.toContain("发布当前文稿");
    expect(html).not.toContain("进入禅模式");
    expect(html).not.toContain("隐藏 AI 面板");
    expect(html).not.toContain("is-active");
  });

  it("does not keep the inspector toggle visually active while the inspector is open", () => {
    const handler = vi.fn();
    const html = renderToStaticMarkup(
      createElement(EditorToolbar, {
        inspectorOpen: true,
        focusMode: false,
        leftSidebarHidden: false,
        canNavigateBack: true,
        canNavigateForward: true,
        canPublish: true,
        onExpandLeftSidebar: handler,
        onToggleFocusMode: handler,
        onNavigateBack: handler,
        onNavigateForward: handler,
        onToggleInspector: handler,
        onSelectPublishChannel: handler,
        onWindowToolbarDoubleClick: handler,
      }),
    );

    expect(html).toContain("隐藏 AI 面板");
    expect(html).not.toContain("is-active");
  });
});
