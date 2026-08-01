/**
 * [INPUT]: 依赖 React 运行时、稳定回调与编辑器 Markdown 标题解析
 * [OUTPUT]: 对外提供输入暂停后低频刷新、使用预计算源码位置的 EditorOutlineNavigator
 * [POS]: 编辑器大纲的旁路投影；正文高频提交只重置刷新计时，标题解析和标记树在短暂停顿后更新，实际滚动几何仍由 EditorCanvas 持有
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { motion, useReducedMotion } from "motion/react";
import { memo, useEffect, useMemo, useRef, useState, type CSSProperties, type FocusEvent, type KeyboardEvent } from "react";
import { editorOutlineMarkerWidth } from "@/features/editor/model/editorOutlineNavigator";
import { getSheetHeadings } from "@/features/editor/model/markdownOutline";
import { useLatestCallback } from "@/shared/hooks/useLatestCallback";

interface EditorOutlineNavigatorProps {
  body: string;
  onRevealPosition: (position: number) => void;
}

const MARKER_SPRING = {
  type: "spring" as const,
  stiffness: 520,
  damping: 38,
  mass: 0.35,
};
const OUTLINE_REFRESH_DELAY_MS = 400;

export function EditorOutlineNavigator({ body, onRevealPosition }: EditorOutlineNavigatorProps) {
  const [projectedBody, setProjectedBody] = useState(body);
  const handleRevealPosition = useLatestCallback(onRevealPosition);

  useEffect(() => {
    if (body === projectedBody) return;
    const timer = window.setTimeout(() => setProjectedBody(body), OUTLINE_REFRESH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [body, projectedBody]);

  const headings = useMemo(() => getSheetHeadings(projectedBody), [projectedBody]);
  return <EditorOutlineMarkers headings={headings} onRevealPosition={handleRevealPosition} />;
}

const EditorOutlineMarkers = memo(function EditorOutlineMarkers({
  headings,
  onRevealPosition,
}: {
  headings: ReturnType<typeof getSheetHeadings>;
  onRevealPosition: (position: number) => void;
}) {
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const activeIndex = hoveredIndex ?? focusedIndex;

  if (headings.length < 2) return null;

  function focusHeading(index: number) {
    const nextIndex = (index + headings.length) % headings.length;
    setFocusedIndex(nextIndex);
    buttonRefs.current[nextIndex]?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusHeading(index + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusHeading(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusHeading(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusHeading(headings.length - 1);
    } else if (event.key === "Escape") {
      event.currentTarget.blur();
    }
  }

  function handleBlur(event: FocusEvent<HTMLElement>) {
    if (!event.currentTarget.contains(event.relatedTarget)) setFocusedIndex(null);
  }

  const style = {
    "--editor-outline-row-height": `min(9px, max(3px, calc(60vh / ${headings.length})))`,
  } as CSSProperties;

  return (
    <nav
      className="editor-outline-navigator"
      aria-label="文稿目录"
      style={style}
      onMouseLeave={() => setHoveredIndex(null)}
      onBlur={handleBlur}
    >
      <ol className="editor-outline-list">
        {headings.map((heading, index) => {
          const active = activeIndex === index;
          return (
            <li key={heading.id} className="editor-outline-item" data-active={active || undefined}>
              <button
                ref={(button) => {
                  buttonRefs.current[index] = button;
                }}
                type="button"
                className="editor-outline-button"
                aria-label={`跳转到标题：${heading.text}`}
                tabIndex={focusedIndex === index || (focusedIndex === null && index === 0) ? 0 : -1}
                onMouseEnter={() => setHoveredIndex(index)}
                onFocus={() => setFocusedIndex(index)}
                onKeyDown={(event) => handleKeyDown(event, index)}
                onClick={() => onRevealPosition(heading.position)}
              >
                <motion.span
                  className="editor-outline-marker"
                  aria-hidden="true"
                  initial={false}
                  animate={{ width: editorOutlineMarkerWidth(index, activeIndex) }}
                  transition={prefersReducedMotion ? { duration: 0 } : MARKER_SPRING}
                />
                <span className="editor-outline-title" aria-hidden={!active}>
                  {heading.text}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
});
