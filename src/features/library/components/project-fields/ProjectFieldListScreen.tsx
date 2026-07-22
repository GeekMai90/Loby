/**
 * [INPUT]: 依赖 lucide-react、React 运行时、shadcn/ui 基础控件、shared 公共契约、写作库模块
 * [OUTPUT]: 对外提供 FieldListScreen
 * [POS]: 写作库 feature 的界面组合单元，连接 写作库 状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { GripVertical, LockKeyhole, Pencil, Trash2 } from "lucide-react";
import { useRef, useState, type PointerEvent } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/shared/lib/utils";
import { fieldTypeLabel } from "@/features/library/constants/propertyFields";
import type { RailDropPosition } from "@/features/library/model/sheetSorting";
import type { ProjectPropertyDefinition } from "@/shared/types";
import { ProjectFieldTypeIcon } from "@/features/library/components/project-fields/ProjectFieldTypeIcon";

interface PropertyDragState {
  id: string;
  overId?: string;
  position?: RailDropPosition;
}

interface PropertyPointerDragSession {
  id: string;
  startX: number;
  startY: number;
  active: boolean;
}

export function FieldListScreen({
  definitions,
  onEdit,
  onRemove,
  onReorder,
}: {
  definitions: ProjectPropertyDefinition[];
  onEdit: (definition: ProjectPropertyDefinition) => void;
  onRemove: (definition: ProjectPropertyDefinition) => void;
  onReorder: (sourceId: string, targetId: string, position: RailDropPosition) => void;
}) {
  const [dragState, setDragState] = useState<PropertyDragState | null>(null);
  const dragStateRef = useRef<PropertyDragState | null>(null);
  const pointerDragRef = useRef<PropertyPointerDragSession | null>(null);

  function updateDragState(nextDragState: PropertyDragState | null) {
    dragStateRef.current = nextDragState;
    setDragState(nextDragState);
  }

  function startPointerDrag(id: string, event: PointerEvent<HTMLElement>) {
    if (event.button !== 0) return;
    pointerDragRef.current = {
      id,
      startX: event.clientX,
      startY: event.clientY,
      active: false,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function updatePointerDrag(event: PointerEvent<HTMLElement>) {
    const session = pointerDragRef.current;
    if (!session) return;

    const distance = Math.hypot(event.clientX - session.startX, event.clientY - session.startY);
    if (!session.active && distance < 4) return;
    session.active = true;
    event.preventDefault();

    const target = document.elementFromPoint(event.clientX, event.clientY);
    const targetRow = target instanceof Element ? target.closest<HTMLElement>("[data-property-definition-id]") : null;
    const targetId = targetRow?.dataset.propertyDefinitionId;
    const targetPinned = targetRow?.dataset.propertyDefinitionPinned === "true";
    if (!targetRow || !targetId || targetId === session.id || targetPinned) {
      updateDragState({ id: session.id });
      return;
    }

    const rect = targetRow.getBoundingClientRect();
    updateDragState({
      id: session.id,
      overId: targetId,
      position: event.clientY > rect.top + rect.height / 2 ? "after" : "before",
    });
  }

  function finishPointerDrag(event: PointerEvent<HTMLElement>) {
    const session = pointerDragRef.current;
    const finalDragState = dragStateRef.current;
    event.currentTarget.releasePointerCapture?.(event.pointerId);

    if (session?.active) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (session?.active && finalDragState?.overId && finalDragState.position) {
      onReorder(session.id, finalDragState.overId, finalDragState.position);
    }

    pointerDragRef.current = null;
    updateDragState(null);
  }

  function cancelPointerDrag() {
    pointerDragRef.current = null;
    updateDragState(null);
  }

  return (
    <div className="mx-auto w-[calc(100%-48px)] py-3 max-[720px]:w-[calc(100%-32px)]">
      <div className="grid gap-1">
        {definitions.map((definition) => {
          const pinned = Boolean(definition.locked);
          return (
            <div
              key={definition.id}
              data-property-definition-id={definition.id}
              data-property-definition-pinned={pinned || undefined}
              className={cn(
                "group relative flex min-h-14 items-center gap-2 rounded-xl px-2 transition-colors hover:bg-muted/65 focus-within:bg-muted/65",
                dragState?.id === definition.id && "opacity-45",
                dragState?.overId === definition.id &&
                  dragState.position === "before" &&
                  "before:absolute before:inset-x-3 before:-top-0.5 before:h-0.5 before:rounded-full before:bg-primary before:content-['']",
                dragState?.overId === definition.id &&
                  dragState.position === "after" &&
                  "after:absolute after:inset-x-3 after:-bottom-0.5 after:h-0.5 after:rounded-full after:bg-primary after:content-['']",
              )}
            >
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                disabled={pinned}
                className="-ml-1 touch-none cursor-grab text-muted-foreground/55 hover:text-muted-foreground active:cursor-grabbing disabled:cursor-default disabled:opacity-25"
                aria-label={pinned ? `${definition.label}为系统属性，不能调整顺序` : `拖拽排序：${definition.label}`}
                title={pinned ? "系统属性不能调整顺序" : "拖拽调整顺序"}
                onPointerDown={(event) => startPointerDrag(definition.id, event)}
                onPointerMove={updatePointerDrag}
                onPointerUp={finishPointerDrag}
                onPointerCancel={cancelPointerDrag}
              >
                <GripVertical />
              </Button>
              <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/75 text-muted-foreground">
                <ProjectFieldTypeIcon type={definition.type} />
              </span>
              <span className="grid min-w-0 flex-1 gap-0.75">
                <strong className="truncate text-[13px] font-semibold">{definition.label}</strong>
                <small className="truncate text-[11px] text-muted-foreground">
                  {fieldTypeLabel(definition.type)} · {definition.key}
                </small>
              </span>
              {definition.locked && (
                <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                  <LockKeyhole size={11} /> 系统
                </span>
              )}
              {!definition.locked && (
                <div className="flex shrink-0 gap-0.5 opacity-60 group-hover:opacity-100 focus-within:opacity-100">
                  <Button type="button" variant="ghost" size="icon-sm" title="编辑属性" onClick={() => onEdit(definition)}>
                    <Pencil />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    title="删除属性"
                    onClick={() => onRemove(definition)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
