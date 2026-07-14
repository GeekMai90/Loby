import type { MouseEvent, ReactNode } from "react";

interface InspectorPanelProps {
  ai: ReactNode;
  onResizeStart: (event: MouseEvent<HTMLDivElement>) => void;
  onActivate: () => void;
}

export function InspectorPanel({ ai, onResizeStart, onActivate }: InspectorPanelProps) {
  return (
    <aside className="inspector px-3 pb-1.5" onPointerDownCapture={onActivate} onFocusCapture={onActivate}>
      <div className="inspector-resize-handle" onMouseDown={onResizeStart} />
      {ai}
    </aside>
  );
}
