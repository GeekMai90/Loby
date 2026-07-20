import type { MouseEvent, ReactNode } from "react";

interface InspectorPanelProps {
  ai: ReactNode;
  onResizeStart: (event: MouseEvent<HTMLDivElement>) => void;
  onActivate: () => void;
}

export function InspectorPanel({ ai, onResizeStart, onActivate }: InspectorPanelProps) {
  return (
    <aside className="inspector" onPointerDownCapture={onActivate} onFocusCapture={onActivate}>
      <div className="inspector-resize-handle" onMouseDown={onResizeStart} />
      {ai}
    </aside>
  );
}
