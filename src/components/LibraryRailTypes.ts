import type { MouseEvent, PointerEvent } from "react";

export type RailDragKind = "project" | "note-group" | "project-group";
export type RailDropPosition = "before" | "after";

export interface RailDragHandlers {
  onStartPointerDrag: (kind: RailDragKind, id: string, event: PointerEvent<HTMLElement>) => void;
  onUpdatePointerDrag: (event: PointerEvent<HTMLElement>) => void;
  onFinishPointerDrag: (event: PointerEvent<HTMLElement>) => void;
  onCancelPointerDrag: () => void;
  onSuppressClickAfterDrag: (event: MouseEvent<HTMLElement>) => boolean;
  railDropClass: (kind: RailDragKind, id: string) => string;
}
