/**
 * [INPUT]: 依赖 React SSR、Vitest、WechatThemeStudioHeader 与内置公众号主题 fixture
 * [OUTPUT]: 验证独立主题工作室标题栏为原生窗口控制保留空间且不再渲染自绘红绿灯
 * [POS]: publishing feature 的窗口 chrome 回归测试，锁定 renderer 与 Tauri 原生标题栏的职责边界
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { WechatThemeStudioHeader } from "@/features/publishing/components/WechatThemeStudioHeader";
import { WECHAT_THEMES } from "@/features/publishing/model/wechatThemes";

describe("WechatThemeStudioHeader", () => {
  it("uses the native window controls instead of rendering custom traffic lights", () => {
    const theme = WECHAT_THEMES[0];
    const handler = vi.fn();
    const html = renderToStaticMarkup(
      createElement(WechatThemeStudioHeader, {
        theme,
        favoriteThemes: [],
        personalThemes: [],
        favoriteThemeIds: [],
        defaultThemeId: theme.id,
        undoCount: 0,
        redoCount: 0,
        previewBusy: false,
        assistantBusy: false,
        manualSaveState: "idle",
        onToggleMaximize: handler,
        onSelectTheme: handler,
        onToggleFavorite: handler,
        onSetDefault: handler,
        onDuplicate: handler,
        onExport: handler,
        onRename: handler,
        onDelete: handler,
        onImport: handler,
        onUndo: handler,
        onRedo: handler,
        onSave: handler,
      }),
    );

    expect(html).toContain("pl-[88px]");
    expect(html).not.toContain("window-controls");
    expect(html).not.toContain("关闭窗口");
  });
});
