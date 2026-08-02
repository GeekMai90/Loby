/**
 * [INPUT]: 依赖 lucide-react、TanStack Virtual、React 运行时、shared 稳定回调、写作库项目映射与公共契约
 * [OUTPUT]: 对外提供动态测量、稳定 key、当前项/拖拽源保活、搜索命中卡片、上下文标签、搜索结果顶部定位与完整列表语义的虚拟化 SheetList，并向 memoized 文稿行传递稳定事件边界
 * [POS]: 写作库文稿 rail 的虚拟窗口边界，仅挂载视口附近文稿行且不介入选择、拖拽或滚动视觉
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { defaultRangeExtractor, useVirtualizer } from "@tanstack/react-virtual";
import { PackageOpen } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, type MouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import type { SheetSelectionModifiers } from "@/features/library/model/sheetSelection";
import type { SheetDropTarget, WritingProject, WritingSheet } from "@/shared/types";
import { useLatestCallback } from "@/shared/hooks/useLatestCallback";
import { SheetRow } from "@/features/library/components/SheetRow";

interface SheetListProps {
  active: boolean;
  sheets: WritingSheet[];
  sheetMetaLabelById: Record<string, string>;
  sheetProjectById: Record<string, WritingProject>;
  libraryPath: string;
  search?: string;
  activeSheetId: string;
  scrollToTopRequest?: { sheetId: string; requestId: number } | null;
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

const SHEET_ROW_ESTIMATED_HEIGHT = 88;
const SHEET_LIST_OVERSCAN = 6;
const SHEET_LIST_INITIAL_RECT = { width: 320, height: 640 };

export function SheetList({
  active,
  sheets,
  sheetMetaLabelById,
  sheetProjectById,
  libraryPath,
  search,
  activeSheetId,
  scrollToTopRequest,
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
  "use no memo"; // TanStack Virtual 的可变内部状态不能由 React Compiler 自动 memoize。

  const listRef = useRef<HTMLDivElement>(null);
  const handledScrollRequestIdRef = useRef<number | null>(null);
  const selectedSheetIdSet = new Set(selectedSheetIds);
  const sheetIndexById = useMemo(() => new Map(sheets.map((sheet, index) => [sheet.id, index])), [sheets]);
  const activeSheetIndex = sheetIndexById.get(activeSheetId) ?? -1;
  const draggingSheetIndex = sheetIndexById.get(draggingSheetId) ?? -1;
  const handleSelectSheet = useLatestCallback(onSelectSheet);
  const handleSheetContextMenu = useLatestCallback(onSheetContextMenu);
  const handleStartPointerDrag = useLatestCallback(onStartPointerDrag);
  const handleSuppressClickAfterDrag = useLatestCallback(onSuppressClickAfterDrag);
  const getSheetKey = useCallback((index: number) => sheets[index]?.id ?? index, [sheets]);
  const extractVirtualRange = useCallback(
    (range: Parameters<typeof defaultRangeExtractor>[0]) => {
      const indexes = new Set(defaultRangeExtractor(range));
      if (activeSheetIndex >= 0) indexes.add(activeSheetIndex);
      if (draggingSheetIndex >= 0) indexes.add(draggingSheetIndex);
      return [...indexes].sort((left, right) => left - right);
    },
    [activeSheetIndex, draggingSheetIndex],
  );
  // TanStack Virtual 依赖稳定实例的内部可变状态；本组件已用 use no memo 明确隔离 compiler。
  // eslint-disable-next-line react-hooks/incompatible-library
  const sheetVirtualizer = useVirtualizer({
    count: sheets.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => SHEET_ROW_ESTIMATED_HEIGHT,
    getItemKey: getSheetKey,
    rangeExtractor: extractVirtualRange,
    overscan: SHEET_LIST_OVERSCAN,
    initialRect: SHEET_LIST_INITIAL_RECT,
  });

  useEffect(() => {
    if (activeSheetIndex < 0) return;
    const shouldPlaceAtTop =
      scrollToTopRequest?.sheetId === activeSheetId && handledScrollRequestIdRef.current !== scrollToTopRequest.requestId;
    sheetVirtualizer.scrollToIndex(activeSheetIndex, { align: shouldPlaceAtTop ? "start" : "auto" });
    if (shouldPlaceAtTop) handledScrollRequestIdRef.current = scrollToTopRequest.requestId;
  }, [activeSheetIndex, activeSheetId, scrollToTopRequest, sheetVirtualizer]);

  function clearSelectionFromBlankArea(event: MouseEvent<HTMLDivElement>) {
    const target = event.target;
    if (target instanceof Element && target.closest(".sheet-row")) return;
    onClearSheetSelection();
  }

  return (
    <div
      ref={listRef}
      className="sheet-list-scroll -mr-3 flex flex-1 flex-col overflow-auto pb-13 pr-3 [scrollbar-gutter:stable]"
      data-active={active}
      onClick={clearSelectionFromBlankArea}
    >
      {sheets.length > 0 && (
        <div
          className="relative w-full flex-none"
          data-sheet-virtualized-count={sheets.length}
          role="list"
          style={{ height: `${sheetVirtualizer.getTotalSize()}px` }}
        >
          {sheetVirtualizer.getVirtualItems().map((virtualItem) => {
            const sheet = sheets[virtualItem.index];
            if (!sheet) return null;
            const selected = selectedSheetIdSet.has(sheet.id);
            const nextSelected = virtualItem.index < sheets.length - 1 && selectedSheetIdSet.has(sheets[virtualItem.index + 1].id);
            const selectedBefore = selected && virtualItem.index > 0 && selectedSheetIdSet.has(sheets[virtualItem.index - 1].id);
            const selectedAfter = selected && nextSelected;

            return (
              <div
                key={virtualItem.key}
                ref={sheetVirtualizer.measureElement}
                className="absolute top-0 left-0 w-full"
                data-index={virtualItem.index}
                data-sheet-virtual-item={sheet.id}
                role="listitem"
                aria-posinset={virtualItem.index + 1}
                aria-setsize={sheets.length}
                style={{ transform: `translateY(${virtualItem.start}px)` }}
              >
                <SheetRow
                  sheet={sheet}
                  project={sheetProjectById[sheet.id]}
                  metaLabel={sheetMetaLabelById[sheet.id]}
                  libraryPath={libraryPath}
                  search={search}
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
              </div>
            );
          })}
        </div>
      )}
      {sheets.length === 0 && (
        <div className="m-auto flex flex-col items-center gap-2.5 text-center text-foreground/25">
          <PackageOpen aria-hidden="true" className="size-10" strokeWidth={1.2} />
          <p className="text-base leading-5 font-medium">没有文稿</p>
        </div>
      )}
    </div>
  );
}
