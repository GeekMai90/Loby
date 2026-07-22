/**
 * [INPUT]: 依赖 同目录稳定契约
 * [OUTPUT]: 对外提供 editorOutlineMarkerWidth
 * [POS]: 编辑器 feature 的领域模型边界，集中 编辑器 规则、数据转换与外部契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
const MARKER_WIDTHS = [26, 18, 13, 9] as const;
const RESTING_MARKER_WIDTH = 6;

export function editorOutlineMarkerWidth(index: number, activeIndex: number | null): number {
  if (activeIndex === null) return RESTING_MARKER_WIDTH;
  return MARKER_WIDTHS[Math.abs(index - activeIndex)] ?? RESTING_MARKER_WIDTH;
}
