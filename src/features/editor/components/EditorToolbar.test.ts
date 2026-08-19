// @vitest-environment happy-dom

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EditorToolbar } from "@/features/editor/components/EditorToolbar";

const originalUserAgent = navigator.userAgent;

describe("EditorToolbar", () => {
  afterEach(() => {
    Object.defineProperty(navigator, "userAgent", { configurable: true, value: originalUserAgent });
    delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  });

  it("keeps only the focus-mode exit action visible while focus mode is active", () => {
    const handler = vi.fn();
    const html = renderToStaticMarkup(
      createElement(EditorToolbar, {
        focusMode: true,
        leftSidebarHidden: false,
        canNavigateBack: true,
        canNavigateForward: true,
        canPublish: true,
        canInsertImage: true,
        documentInformationControl: createElement("button", null, "文稿信息"),
        onExpandLeftSidebar: handler,
        onToggleFocusMode: handler,
        onNavigateBack: handler,
        onNavigateForward: handler,
        onInsertImage: handler,
        onSelectPublishChannel: handler,
        onWindowDragStart: handler,
        onWindowToolbarDoubleClick: handler,
      }),
    );

    expect(html).toContain("退出专注模式");
    expect(html).not.toContain("文稿前后导航");
    expect(html).not.toContain("发布当前文稿");
    expect(html).not.toContain("文稿信息");
    expect(html).not.toContain("is-active");
    expect(html).not.toContain("data-tauri-drag-region");
  });

  it("keeps document actions visible without duplicating the assistant launcher", () => {
    const handler = vi.fn();
    const html = renderToStaticMarkup(
      createElement(EditorToolbar, {
        focusMode: false,
        leftSidebarHidden: false,
        canNavigateBack: true,
        canNavigateForward: true,
        canPublish: true,
        canInsertImage: true,
        documentInformationControl: createElement("button", null, "文稿信息"),
        onExpandLeftSidebar: handler,
        onToggleFocusMode: handler,
        onNavigateBack: handler,
        onNavigateForward: handler,
        onInsertImage: handler,
        onSelectPublishChannel: handler,
        onWindowDragStart: handler,
        onWindowToolbarDoubleClick: handler,
      }),
    );

    expect(html).toContain("文稿信息");
    expect(html).toContain("bg-background");
    expect(html).not.toContain("bg-transparent");
    expect(html).not.toContain("AI 面板");
    expect(html).not.toContain("is-active");
  });

  it("delegates macOS toolbar dragging and double-click maximize to Tauri", () => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", { configurable: true, value: {} });
    Object.defineProperty(navigator, "userAgent", { configurable: true, value: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)" });

    const html = renderToStaticMarkup(
      createElement(EditorToolbar, {
        focusMode: false,
        leftSidebarHidden: false,
        canNavigateBack: true,
        canNavigateForward: true,
        canPublish: true,
        canInsertImage: true,
        onExpandLeftSidebar: vi.fn(),
        onToggleFocusMode: vi.fn(),
        onNavigateBack: vi.fn(),
        onNavigateForward: vi.fn(),
        onInsertImage: vi.fn(),
        onSelectPublishChannel: vi.fn(),
        onWindowDragStart: vi.fn(),
        onWindowToolbarDoubleClick: vi.fn(),
      }),
    );

    expect(html).toContain("data-tauri-drag-region");
  });

  it("disables image insertion until the editor has focus", () => {
    const handler = vi.fn();
    const disabledHtml = renderToStaticMarkup(
      createElement(EditorToolbar, {
        focusMode: false,
        leftSidebarHidden: false,
        canNavigateBack: true,
        canNavigateForward: true,
        canPublish: true,
        canInsertImage: false,
        onExpandLeftSidebar: handler,
        onToggleFocusMode: handler,
        onNavigateBack: handler,
        onNavigateForward: handler,
        onInsertImage: handler,
        onSelectPublishChannel: handler,
        onWindowDragStart: handler,
        onWindowToolbarDoubleClick: handler,
      }),
    );
    expect(disabledHtml).toContain('aria-label="插入图片"');
    expect(disabledHtml).toContain('disabled=""');
    expect(disabledHtml).toContain("请先将光标放入正文");

    const enabledHtml = renderToStaticMarkup(
      createElement(EditorToolbar, {
        focusMode: false,
        leftSidebarHidden: false,
        canNavigateBack: true,
        canNavigateForward: true,
        canPublish: true,
        canInsertImage: true,
        onExpandLeftSidebar: handler,
        onToggleFocusMode: handler,
        onNavigateBack: handler,
        onNavigateForward: handler,
        onInsertImage: handler,
        onSelectPublishChannel: handler,
        onWindowDragStart: handler,
        onWindowToolbarDoubleClick: handler,
      }),
    );
    expect(enabledHtml).toContain('title="插入图片"');
    expect(enabledHtml.indexOf("插入图片")).toBeLessThan(enabledHtml.indexOf("专注模式"));
  });
});
