/**
 * [INPUT]: 依赖 shared 的 SidebarCollapseMode 与当前两栏可见状态
 * [OUTPUT]: 对外提供侧边栏折叠模式默认值、折叠结果与模式切换时的可见状态对齐规则
 * [POS]: 写作库 rail 布局的纯规则边界，供 app 组合层和设置行为复用，不持有 React 或持久化状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { SidebarCollapseMode } from "@/shared/types";

export const DEFAULT_SIDEBAR_COLLAPSE_MODE: SidebarCollapseMode = "navigation-only";

export interface SidebarRailVisibility {
  libraryRailOpen: boolean;
  sheetRailOpen: boolean;
}

export function resolveSidebarCollapse(mode: SidebarCollapseMode): SidebarRailVisibility {
  return {
    libraryRailOpen: false,
    sheetRailOpen: mode === "navigation-only",
  };
}

export function synchronizeSidebarRailsForMode(mode: SidebarCollapseMode, visibility: SidebarRailVisibility): SidebarRailVisibility {
  if (mode === "navigation-only") return visibility;
  return {
    libraryRailOpen: visibility.libraryRailOpen,
    sheetRailOpen: visibility.libraryRailOpen,
  };
}
