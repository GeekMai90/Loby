/**
 * [INPUT]: 依赖 lucide-react、React 运行时、shared 稳定回调、写作库模块与公共契约
 * [OUTPUT]: 对外提供向 memoized 文稿行传递稳定事件边界的 SheetList
 * [POS]: 写作库文稿 rail 的列表组合边界，列表刷新时保留未变化行的渲染结果
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { PackageOpen } from "lucide-react";
import type { MouseEvent, PointerEvent as ReactPointerEvent } from "react";
import type { SheetSelectionModifiers } from "@/features/library/model/sheetSelection";
import type { SheetDropTarget, WritingSheet } from "@/shared/types";
import { useLatestCallback } from "@/shared/hooks/useLatestCallback";
import { SheetRow } from "@/features/library/components/SheetRow";

interface SheetListProps {
  active: boolean;
  sheets: WritingSheet[];
  sheetProjectTitleById: Record<string, string>;
  activeSheetId: string;
  selectedSheetIds: string[];
  draggingSheetId: string;
  dropTarget: SheetDropTarget | null;
  canReorderSheets: boolean;
  canMoveSheets: boolean;
  onClearSheetSelection: () => void;
  onSelectSheet: (sheetId: string, modifiers: SheetSelectionModifiers) => void;
  onSheetContextMenu: (event: MouseEvent<HTMLElement>, sheetId: string) => void;
  onStartPointerDrag: (sheetId: string, event: ReactPointerEvent<HTMLElement>) => void;
  onSuppressClickAfterDrag: (event: MouseEvent<HTMLElement>) => boolean;
}

export function SheetList({
  active,
  sheets,
  sheetProjectTitleById,
  activeSheetId,
  selectedSheetIds,
  draggingSheetId,
  dropTarget,
  canReorderSheets,
  canMoveSheets,
  onClearSheetSelection,
  onSelectSheet,
  onSheetContextMenu,
  onStartPointerDrag,
  onSuppressClickAfterDrag,
}: SheetListProps) {
  const selectedSheetIdSet = new Set(selectedSheetIds);
  const handleSelectSheet = useLatestCallback(onSelectSheet);
  const handleSheetContextMenu = useLatestCallback(onSheetContextMenu);
  const handleStartPointerDrag = useLatestCallback(onStartPointerDrag);
  const handleSuppressClickAfterDrag = useLatestCallback(onSuppressClickAfterDrag);

  function clearSelectionFromBlankArea(event: MouseEvent<HTMLDivElement>) {
    const target = event.target;
    if (target instanceof Element && target.closest(".sheet-row")) return;
    onClearSheetSelection();
  }

  return (
    <div
      className="sheet-list-scroll -mr-3 flex flex-1 flex-col overflow-auto pb-13 pr-3 [scrollbar-gutter:stable]"
      data-active={active}
      onClick={clearSelectionFromBlankArea}
    >
      {sheets.map((sheet, index) => {
        const selected = selectedSheetIdSet.has(sheet.id);
        const nextSelected = index < sheets.length - 1 && selectedSheetIdSet.has(sheets[index + 1].id);
        const selectedBefore = selected && index > 0 && selectedSheetIdSet.has(sheets[index - 1].id);
        const selectedAfter = selected && nextSelected;

        return (
          <SheetRow
            key={sheet.id}
            sheet={sheet}
            projectTitle={sheetProjectTitleById[sheet.id]}
            selected={selected}
            nextSelected={nextSelected}
            selectedBefore={selectedBefore}
            selectedAfter={selectedAfter}
            current={activeSheetId === sheet.id}
            active={active}
            dragging={draggingSheetId === sheet.id}
            dropPosition={dropTarget?.sheetId === sheet.id ? dropTarget.position : null}
            reorderable={canReorderSheets}
            movable={canMoveSheets}
            onSelectSheet={handleSelectSheet}
            onContextMenu={handleSheetContextMenu}
            onStartPointerDrag={handleStartPointerDrag}
            onSuppressClickAfterDrag={handleSuppressClickAfterDrag}
          />
        );
      })}
      {sheets.length === 0 && (
        <div className="m-auto flex flex-col items-center gap-2.5 text-center text-foreground/40">
          <PackageOpen aria-hidden="true" className="size-10" strokeWidth={1.4} />
          <p className="text-sm leading-5 font-medium">没有文稿</p>
        </div>
      )}
    </div>
  );
}
