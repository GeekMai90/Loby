/**
 * [INPUT]: 依赖 React 运行时、WritingSheet、文稿卡片投影结果与列表搜索词
 * [OUTPUT]: 对外提供 Bear 式 SheetCard 展示组件与 SheetCardImage 契约，并在列表搜索时展示命中行与高亮文本、置顶标记
 * [POS]: 写作库文稿 rail 的纯展示卡片；SheetRow 持有选择、拖拽与键盘交互，本组件只负责三种内容密度、搜索结果投影与置顶状态呈现
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useEffect, useState } from "react";
import { Pin } from "lucide-react";
import type { WritingSheet } from "@/shared/types";
import { SearchHighlight } from "@/features/library/components/SearchHighlight";
import { getSheetDisplayTitle, getSheetMetaText, getSheetSearchPreview, isBlankSheet } from "@/features/library/model/sheetRail";

export interface SheetCardImage {
  alt: string;
  src: string;
}

interface SheetCardProps {
  sheet: WritingSheet;
  projectTitle?: string;
  image: SheetCardImage | null;
  search?: string;
}

const RECENT_TIME_REFRESH_MS = 60_000;

export function SheetCard({ sheet, projectTitle, image, search = "" }: SheetCardProps) {
  const [now, setNow] = useState(() => new Date());
  const [failedImageSource, setFailedImageSource] = useState("");
  const blank = isBlankSheet(sheet);
  const title = blank ? "未命名新文稿" : getSheetDisplayTitle(sheet);
  const preview = blank ? "调整内心，写点东西" : getSheetSearchPreview(sheet, search) || sheet.description;
  const visibleImage = image && image.src !== failedImageSource ? image : null;

  useEffect(() => {
    const sourceTimestamp = Date.parse(sheet.updatedAt || sheet.createdAt);
    if (!Number.isFinite(sourceTimestamp) || Date.now() - sourceTimestamp >= 60 * RECENT_TIME_REFRESH_MS) return;
    const interval = window.setInterval(() => setNow(new Date()), RECENT_TIME_REFRESH_MS);
    return () => window.clearInterval(interval);
  }, [sheet.createdAt, sheet.updatedAt]);

  return (
    <div className="sheet-card flex min-h-0 flex-1 flex-col">
      <div className="sheet-card-copy">
        <strong className="sheet-card-title line-clamp-2">
          <SearchHighlight text={title} query={search} />
        </strong>
        <span className="sheet-row-preview sheet-card-preview truncate">
          <SearchHighlight text={preview || "\u00a0"} query={search} />
        </span>
      </div>
      {visibleImage && (
        <img
          className="sheet-card-image"
          src={visibleImage.src}
          alt={visibleImage.alt || title}
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setFailedImageSource(visibleImage.src)}
        />
      )}
      <small className="sheet-row-meta sheet-card-meta truncate">
        {sheet.pinned && (
          <Pin className="sheet-card-pin" aria-label="已置顶">
            <title>已置顶</title>
          </Pin>
        )}
        {getSheetMetaText(sheet, projectTitle, now)}
      </small>
    </div>
  );
}
