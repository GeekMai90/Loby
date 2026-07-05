import type { MouseEvent, ReactNode } from "react";

interface InspectorPanelProps {
  ai: ReactNode;
  onResizeStart: (event: MouseEvent<HTMLDivElement>) => void;
}

export function InspectorPanel({ ai, onResizeStart }: InspectorPanelProps) {
  return (
    <aside className="inspector ai-inspector">
      <div className="inspector-resize-handle" onMouseDown={onResizeStart} />
      {ai}
    </aside>
  );
}
