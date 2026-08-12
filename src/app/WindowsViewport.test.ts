/**
 * [INPUT]: 依赖 Node.js 文件读取、Windows Tauri 平台配置与 renderer 基础/窗口外壳样式源码
 * [OUTPUT]: 验证 Windows 高 DPI 工作区不会被固定最小高度撑大，Portal 模态窗也不会进入自定义标题栏区域
 * [POS]: app 组合层的 Windows 视口契约回归边界，防止原生工作区、WebView 根布局和模态安全区再次冲突
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import windowsConfig from "../../src-tauri/tauri.windows.conf.json";

const baseStyles = readFileSync(new URL("../styles/base.css", import.meta.url), "utf8");
const shellStyles = readFileSync(new URL("../styles/shell.css", import.meta.url), "utf8");

describe("Windows viewport constraints", () => {
  it("lets the Windows work area override the desktop design height", () => {
    const mainWindow = windowsConfig.app.windows[0];
    const bodyRule = baseStyles.match(/\bbody\s*\{([^}]*)\}/)?.[1] ?? "";
    const windowsContentRule = shellStyles.match(/\.windows-app-content\s*>\s*\.loby-window\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(mainWindow.preventOverflow).toBe(true);
    expect(mainWindow.minHeight).toBeNull();
    expect(bodyRule).not.toMatch(/min-height\s*:/);
    expect(windowsContentRule).toMatch(/min-height\s*:\s*0/);
    expect(windowsContentRule).toMatch(/height\s*:\s*100%/);
  });

  it("keeps portalled dialogs inside the content area below the custom titlebar", () => {
    const windowsDialogViewport = shellStyles.match(/body:has\(\.windows-app-frame\)\s*\{([^}]*)\}/)?.[1] ?? "";
    const centeredDialogRule =
      shellStyles.match(
        /body:has\(\.windows-app-frame\) \[data-slot="dialog-content"\]\[data-dialog-placement="centered"\],[\s\S]*?\{([^}]*)\}/,
      )?.[1] ?? "";
    const overlayRule =
      shellStyles.match(
        /body:has\(\.windows-app-frame\) :is\(\[data-slot="dialog-overlay"\], \[data-slot="alert-dialog-overlay"\]\)\s*\{([^}]*)\}/,
      )?.[1] ?? "";

    expect(windowsDialogViewport).toMatch(/--windows-titlebar-height\s*:\s*36px/);
    expect(windowsDialogViewport).toMatch(/--windows-titlebar-center-offset\s*:\s*18px/);
    expect(centeredDialogRule).toMatch(/top\s*:\s*calc\(50% \+ var\(--windows-titlebar-center-offset\)\)/);
    expect(centeredDialogRule).toMatch(/min-height\s*:\s*0/);
    expect(centeredDialogRule).toMatch(/max-height\s*:\s*calc\(100vh - var\(--windows-titlebar-height\) - 16px\)/);
    expect(overlayRule).toMatch(/top\s*:\s*var\(--windows-titlebar-height\)/);
  });
});
