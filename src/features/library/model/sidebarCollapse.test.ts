/**
 * [INPUT]: 依赖 Vitest 与 sidebarCollapse 的侧边栏折叠规则
 * [OUTPUT]: 验证单栏折叠、双栏联动折叠与切换联动模式时的状态对齐
 * [POS]: 写作库 rail 布局规则的纯模型回归边界，不依赖 React、DOM 或持久化
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_SIDEBAR_COLLAPSE_MODE,
  resolveSidebarCollapse,
  synchronizeSidebarRailsForMode,
} from "@/features/library/model/sidebarCollapse";

describe("sidebarCollapse", () => {
  it("defaults to collapsing only the navigation rail", () => {
    expect(DEFAULT_SIDEBAR_COLLAPSE_MODE).toBe("navigation-only");
    expect(resolveSidebarCollapse("navigation-only")).toEqual({ libraryRailOpen: false, sheetRailOpen: true });
  });

  it("collapses both rails in the linked mode", () => {
    expect(resolveSidebarCollapse("navigation-and-list")).toEqual({ libraryRailOpen: false, sheetRailOpen: false });
  });

  it("aligns the list rail to the navigation rail when linked mode is selected", () => {
    expect(synchronizeSidebarRailsForMode("navigation-and-list", { libraryRailOpen: false, sheetRailOpen: true })).toEqual({
      libraryRailOpen: false,
      sheetRailOpen: false,
    });
    expect(synchronizeSidebarRailsForMode("navigation-and-list", { libraryRailOpen: true, sheetRailOpen: false })).toEqual({
      libraryRailOpen: true,
      sheetRailOpen: true,
    });
  });

  it("preserves independent rail visibility in navigation-only mode", () => {
    expect(synchronizeSidebarRailsForMode("navigation-only", { libraryRailOpen: false, sheetRailOpen: false })).toEqual({
      libraryRailOpen: false,
      sheetRailOpen: false,
    });
  });
});
