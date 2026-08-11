/**
 * [INPUT]: 依赖 Node.js 文件读取、Windows Tauri 平台配置与 renderer 基础/窗口外壳样式源码
 * [OUTPUT]: 验证 Windows 高 DPI 工作区不会被固定 720px 最小高度重新撑大
 * [POS]: app 组合层的 Windows 视口契约回归边界，防止原生最小尺寸和 WebView 根布局再次冲突
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
});
