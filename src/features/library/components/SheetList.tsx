/**
 * [INPUT]: 依赖 lucide-react、TanStack Virtual、React 运行时、shared 稳定回调、写作库项目映射与公共契约
 * [OUTPUT]: 对外提供动态测量、稳定 key、当前项/拖拽源保活、搜索命中卡片、上下文标签、搜索结果顶部定位、覆盖式窄滚动条与完整列表语义的虚拟化 SheetList，并向 memoized 文稿行传递稳定事件边界
 * [POS]: 写作库文稿 rail 的虚拟窗口边界，仅挂载视口附近文稿行；滚动指示器覆盖在列表边缘，不参与卡片布局
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { defaultRangeExtractor, useVirtualizer } from "@tanstack/react-virtual";
import { PackageOpen } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
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
const SHEET_SCROLLBAR_MIN_THUMB_HEIGHT = 28;

interface ScrollbarDragState {
  pointerId: number;
  startClientY: number;
  startScrollTop: number;
  maxThumbOffset: number;
  scrollRange: number;
}

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
  const scrollbarTrackRef = useRef<HTMLDivElement>(null);
  const scrollbarThumbRef = useRef<HTMLDivElement>(null);
  const scrollbarDragRef = useRef<ScrollbarDragState | null>(null);
  const listId = `sheet-list-${useId().replace(/:/g, "")}`;
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
    const list = listRef.current;
    const track = scrollbarTrackRef.current;
    const thumb = scrollbarThumbRef.current;
    if (!list || !track || !thumb) return;
    const listElement = list;
    const trackElement = track;
    const thumbElement = thumb;

    function syncScrollbar() {
      const scrollRange = Math.max(0, listElement.scrollHeight - listElement.clientHeight);
      const trackHeight = trackElement.clientHeight;
      const scrollable = scrollRange > 1 && trackHeight > 0;
      const thumbHeight = scrollable
        ? Math.min(
            trackHeight,
            Math.max(SHEET_SCROLLBAR_MIN_THUMB_HEIGHT, (trackHeight * listElement.clientHeight) / listElement.scrollHeight),
          )
        : 0;
      const maxThumbOffset = Math.max(0, trackHeight - thumbHeight);
      const scrollRatio = scrollRange > 0 ? listElement.scrollTop / scrollRange : 0;

      trackElement.dataset.visible = scrollable ? "true" : "false";
      trackElement.tabIndex = scrollable && active ? 0 : -1;
      trackElement.setAttribute("aria-valuemax", String(Math.round(scrollRange)));
      trackElement.setAttribute("aria-valuenow", String(Math.round(listElement.scrollTop)));
      thumbElement.style.height = `${thumbHeight}px`;
      thumbElement.style.transform = `translateY(${Math.min(1, Math.max(0, scrollRatio)) * maxThumbOffset}px)`;
    }

    listElement.addEventListener("scroll", syncScrollbar, { passive: true });
    syncScrollbar();

    const frame = typeof window.requestAnimationFrame === "function" ? window.requestAnimationFrame(syncScrollbar) : 0;
    const resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(syncScrollbar) : null;
    resizeObserver?.observe(listElement);
    if (listElement.firstElementChild) resizeObserver?.observe(listElement.firstElementChild);

    return () => {
      listElement.removeEventListener("scroll", syncScrollbar);
      if (frame) window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
    };
  }, [active, sheets.length]);

  useEffect(() => {
    const trackElement = scrollbarTrackRef.current;

    function handleScrollbarPointerMove(event: globalThis.PointerEvent) {
      const drag = scrollbarDragRef.current;
      const list = listRef.current;
      if (!drag || drag.pointerId !== event.pointerId || !list) return;

      const scrollDelta = ((event.clientY - drag.startClientY) / drag.maxThumbOffset) * drag.scrollRange;
      event.preventDefault();
      list.scrollTop = clamp(drag.startScrollTop + scrollDelta, 0, drag.scrollRange);
    }

    function finishScrollbarPointerDrag(event: globalThis.PointerEvent) {
      if (scrollbarDragRef.current?.pointerId !== event.pointerId) return;
      trackElement?.removeAttribute("data-dragging");
      scrollbarDragRef.current = null;
    }

    window.addEventListener("pointermove", handleScrollbarPointerMove, { passive: false });
    window.addEventListener("pointerup", finishScrollbarPointerDrag, true);
    window.addEventListener("pointercancel", finishScrollbarPointerDrag, true);

    return () => {
      window.removeEventListener("pointermove", handleScrollbarPointerMove);
      window.removeEventListener("pointerup", finishScrollbarPointerDrag, true);
      window.removeEventListener("pointercancel", finishScrollbarPointerDrag, true);
      trackElement?.removeAttribute("data-dragging");
      scrollbarDragRef.current = null;
    };
  }, []);

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

  function scrollbarMetrics() {
    const list = listRef.current;
    const track = scrollbarTrackRef.current;
    const thumb = scrollbarThumbRef.current;
    if (!list || !track || !thumb) return null;

    const scrollRange = Math.max(0, list.scrollHeight - list.clientHeight);
    const thumbHeight = thumb.getBoundingClientRect().height;
    const maxThumbOffset = Math.max(0, track.clientHeight - thumbHeight);
    if (scrollRange <= 1 || maxThumbOffset <= 0) return null;
    return { list, track, scrollRange, thumbHeight, maxThumbOffset };
  }

  function handleScrollbarTrackPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || event.target !== event.currentTarget) return;
    const metrics = scrollbarMetrics();
    if (!metrics) return;

    const trackRect = metrics.track.getBoundingClientRect();
    const targetOffset = clamp(event.clientY - trackRect.top - metrics.thumbHeight / 2, 0, metrics.maxThumbOffset);
    event.preventDefault();
    event.stopPropagation();
    metrics.list.scrollTop = (targetOffset / metrics.maxThumbOffset) * metrics.scrollRange;
  }

  function handleScrollbarThumbPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const metrics = scrollbarMetrics();
    if (!metrics) return;

    scrollbarDragRef.current = {
      pointerId: event.pointerId,
      startClientY: event.clientY,
      startScrollTop: metrics.list.scrollTop,
      maxThumbOffset: metrics.maxThumbOffset,
      scrollRange: metrics.scrollRange,
    };
    scrollbarTrackRef.current?.setAttribute("data-dragging", "true");
    event.preventDefault();
    event.stopPropagation();
  }

  function handleScrollbarKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const list = listRef.current;
    if (!list) return;

    const page = Math.max(40, list.clientHeight * 0.9);
    const nextScrollTop =
      event.key === "ArrowDown"
        ? list.scrollTop + 40
        : event.key === "ArrowUp"
          ? list.scrollTop - 40
          : event.key === "PageDown"
            ? list.scrollTop + page
            : event.key === "PageUp"
              ? list.scrollTop - page
              : event.key === "Home"
                ? 0
                : event.key === "End"
                  ? list.scrollHeight - list.clientHeight
                  : null;
    if (nextScrollTop === null) return;
    event.preventDefault();
    list.scrollTop = Math.max(0, Math.min(list.scrollHeight - list.clientHeight, nextScrollTop));
  }

  return (
    <div className="sheet-list-scroll-shell relative -mr-3 flex min-h-0 flex-1">
      <div
        ref={listRef}
        id={listId}
        className="sheet-list-scroll flex min-w-0 flex-1 flex-col overflow-auto pb-13 pr-3"
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
      <div
        ref={scrollbarTrackRef}
        className="sheet-list-scrollbar"
        data-active={active}
        data-visible="false"
        role="scrollbar"
        tabIndex={-1}
        aria-controls={listId}
        aria-label="文稿列表滚动条"
        aria-orientation="vertical"
        aria-valuemin={0}
        aria-valuemax={0}
        aria-valuenow={0}
        onPointerDown={handleScrollbarTrackPointerDown}
        onKeyDown={handleScrollbarKeyDown}
      >
        <div ref={scrollbarThumbRef} className="sheet-list-scrollbar-thumb" onPointerDown={handleScrollbarThumbPointerDown} />
      </div>
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
