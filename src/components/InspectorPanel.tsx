import type { MouseEvent, ReactNode } from "react";

interface InspectorPanelProps {
  ai: ReactNode;
  onResizeStart: (event: MouseEvent<HTMLDivElement>) => void;
}

export function InspectorPanel({ ai, onResizeStart }: InspectorPanelProps) {
  return (
    <aside className="inspector px-3 pb-1.5">
      <div className="inspector-resize-handle" onMouseDown={onResizeStart} />
      {ai}
    </aside>
  );
}
