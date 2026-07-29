/**
 * [INPUT]: 依赖 同目录稳定契约
 * [OUTPUT]: 对外提供 editorOutlineMarkerWidth、editorOutlineTopMargin
 * [POS]: 编辑器大纲的领域规则边界，统一标记宽度与带顶部安全区的目录跳转几何
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
const MARKER_WIDTHS = [26, 18, 13, 9] as const;
const RESTING_MARKER_WIDTH = 6;
const OUTLINE_TOP_MARGIN = 80;

export function editorOutlineTopMargin(viewportHeight: number): number {
  return Math.max(0, Math.min(OUTLINE_TOP_MARGIN, viewportHeight - 1));
}

export function editorOutlineMarkerWidth(index: number, activeIndex: number | null): number {
  if (activeIndex === null) return RESTING_MARKER_WIDTH;
  return MARKER_WIDTHS[Math.abs(index - activeIndex)] ?? RESTING_MARKER_WIDTH;
}
