/**
 * [INPUT]: 依赖 Tauri 资源 URL、clsx、React 运行时、写作库图片/卡片模块与 shared 公共契约
 * [OUTPUT]: 对外提供按文稿引用与行状态 memoized、可承载 Bear 式 SheetCard 的 SheetRow
 * [POS]: 写作库文稿 rail 的交互行边界，负责选择、拖拽和首图资源解析，不拥有卡片内容排版
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import clsx from "clsx";
import { convertFileSrc } from "@tauri-apps/api/core";
import { memo, type KeyboardEvent, type MouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { getSheetPreviewImage } from "@/features/library/model/sheetRail";
import { resolveSheetImageSourcePath } from "@/features/library/model/imageAssets";
import { SheetCard, type SheetCardImage } from "@/features/library/components/SheetCard";
import type { SheetSelectionModifiers } from "@/features/library/model/sheetSelection";
import type { SheetDropTarget, WritingProject, WritingSheet } from "@/shared/types";

interface SheetRowProps {
  active: boolean;
  sheet: WritingSheet;
  project?: WritingProject;
  projectTitle?: string;
  libraryPath: string;
  selected: boolean;
  nextSelected: boolean;
  selectedBefore: boolean;
  selectedAfter: boolean;
  current: boolean;
  dragging: boolean;
  dropPosition: SheetDropTarget["position"] | null;
  reorderable: boolean;
  movable: boolean;
  onSelectSheet: (sheetId: string, modifiers: SheetSelectionModifiers) => void;
  onContextMenu: (event: MouseEvent<HTMLElement>, sheetId: string) => void;
  onStartPointerDrag: (sheetId: string, event: ReactPointerEvent<HTMLElement>) => void;
  onSuppressClickAfterDrag: (event: MouseEvent<HTMLElement>) => boolean;
}

export const SheetRow = memo(function SheetRow({
  active,
  sheet,
  project,
  projectTitle,
  libraryPath,
  selected,
  nextSelected,
  selectedBefore,
  selectedAfter,
  current,
  dragging,
  dropPosition,
  reorderable,
  movable,
  onSelectSheet,
  onContextMenu,
  onStartPointerDrag,
  onSuppressClickAfterDrag,
}: SheetRowProps) {
  function selectSheetFromKeyboard(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onSelectSheet(sheet.id, event);
  }

  const image = resolveSheetCardImage(libraryPath, project, sheet);
  const activeSelection = selected && active;

  return (
    <article
      role="button"
      tabIndex={0}
      className={clsx(
        "sheet-row relative flex min-h-22 flex-none select-none flex-col justify-start text-left outline-none transition-[opacity,transform,background-color] focus-visible:ring-3 focus-visible:ring-ring/50",
        selected
          ? activeSelection
            ? "selected selection-active text-primary-foreground"
            : "selected selection-inactive text-[var(--sheet-selection-inactive-foreground)]"
          : "unselected bg-transparent text-foreground",
        !selected && nextSelected && "before-selected",
        selected && !selectedBefore && "selected-group-start",
        selected && !selectedAfter && "selected-group-end",
        dragging && "dragging",
        dropPosition && `drop-${dropPosition}`,
      )}
      data-sheet-id={sheet.id}
      aria-current={current ? "true" : undefined}
      aria-pressed={selected}
      data-sheet-reorderable={reorderable ? "true" : undefined}
      data-sheet-movable={movable ? "true" : undefined}
      onClick={(event) => {
        if (onSuppressClickAfterDrag(event)) return;
        onSelectSheet(sheet.id, event);
      }}
      onContextMenu={(event) => onContextMenu(event, sheet.id)}
      onKeyDown={selectSheetFromKeyboard}
      onPointerDown={(event) => onStartPointerDrag(sheet.id, event)}
    >
      <span className="sheet-row-divider" aria-hidden="true" />
      <SheetCard sheet={sheet} projectTitle={projectTitle} image={image} />
    </article>
  );
});

function resolveSheetCardImage(libraryPath: string, project: WritingProject | undefined, sheet: WritingSheet): SheetCardImage | null {
  const reference = getSheetPreviewImage(sheet);
  if (!reference) return null;
  if (/^https?:\/\//i.test(reference.path)) return { src: reference.path, alt: reference.alt };
  if (!project) return null;
  const sourcePath = resolveSheetImageSourcePath(libraryPath, project, sheet, reference.path);
  return sourcePath ? { src: convertFileSrc(sourcePath), alt: reference.alt } : null;
}
