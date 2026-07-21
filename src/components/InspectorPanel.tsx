import { motion, useReducedMotion } from "motion/react";
import type { MouseEvent, ReactNode } from "react";
import type { AssistantPresentation } from "../types";
import { cn } from "@/lib/utils";

interface InspectorPanelProps {
  ai: ReactNode;
  presentation: AssistantPresentation;
  onResizeStart: (event: MouseEvent<HTMLDivElement>) => void;
  onActivate: () => void;
}

export function InspectorPanel({ ai, presentation, onResizeStart, onActivate }: InspectorPanelProps) {
  const prefersReducedMotion = useReducedMotion();

  function activateFromPointer() {
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement && activeElement.closest(".cm-editor")) {
      activeElement.blur();
    }
    onActivate();
  }

  function guardEmptySurfaceMouseDown(event: MouseEvent<HTMLElement>) {
    if (event.button !== 0) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (
      target.closest(
        'button, input, textarea, select, a, [contenteditable="true"], [role="menuitem"], [data-slot="assistant-message"], [data-slot="assistant-approval-dock"]',
      )
    ) {
      return;
    }
    event.preventDefault();
  }

  return (
    <motion.aside
      layout={!prefersReducedMotion}
      initial={prefersReducedMotion ? false : floatingTransitionState(presentation)}
      animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
      exit={prefersReducedMotion ? { opacity: 0 } : floatingTransitionState(presentation)}
      transition={{ duration: prefersReducedMotion ? 0.12 : 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={cn("inspector assistant-surface", `assistant-surface--${presentation}`)}
      data-presentation={presentation}
      aria-label="AI 助手"
      onPointerDownCapture={activateFromPointer}
      onMouseDownCapture={guardEmptySurfaceMouseDown}
      onFocusCapture={onActivate}
    >
      {presentation === "docked" ? <div className="inspector-resize-handle" onMouseDown={onResizeStart} /> : null}
      {ai}
    </motion.aside>
  );
}

function floatingTransitionState(presentation: AssistantPresentation) {
  return presentation === "floating" ? { opacity: 0, scale: 0.18, x: 22, y: 22 } : { opacity: 0, scale: 0.985, x: 28, y: 0 };
}
