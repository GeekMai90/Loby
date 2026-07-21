const MARKER_WIDTHS = [26, 18, 13, 9] as const;
const RESTING_MARKER_WIDTH = 6;

export function editorOutlineMarkerWidth(index: number, activeIndex: number | null): number {
  if (activeIndex === null) return RESTING_MARKER_WIDTH;
  return MARKER_WIDTHS[Math.abs(index - activeIndex)] ?? RESTING_MARKER_WIDTH;
}
