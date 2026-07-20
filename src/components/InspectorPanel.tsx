import type { MouseEvent, ReactNode } from "react";

interface InspectorPanelProps {
  ai: ReactNode;
  onResizeStart: (event: MouseEvent<HTMLDivElement>) => void;
  onActivate: () => void;
}

export function InspectorPanel({ ai, onResizeStart, onActivate }: InspectorPanelProps) {
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
    <aside
      className="inspector"
      onPointerDownCapture={activateFromPointer}
      onMouseDownCapture={guardEmptySurfaceMouseDown}
      onFocusCapture={onActivate}
    >
      <div className="inspector-resize-handle" onMouseDown={onResizeStart} />
      {ai}
    </aside>
  );
}
