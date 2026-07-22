/**
 * [INPUT]: 依赖 React 运行时
 * [OUTPUT]: 对外提供 RailDragKind、RailDropPosition、RailDragHandlers
 * [POS]: 写作库 feature 的界面组合单元，连接 写作库 状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
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
