import { formatSnapshotTime } from "../lib/formatters";
import { Button } from "@/components/ui/button";
import { positionFromLine, type buildDocumentImageItems } from "../lib/documentFunctionRail";
import type { SheetHeading } from "../lib/markdownOutline";
import type { SheetVersion } from "../types";
import clsx from "clsx";

type DocumentImageItem = ReturnType<typeof buildDocumentImageItems>[number];

interface DocumentOutlineSectionProps {
  body: string;
  headings: SheetHeading[];
  onRevealPosition: (position: number) => void;
}

interface DocumentMediaSectionProps {
  images: DocumentImageItem[];
  onRevealPosition: (position: number) => void;
}

interface DocumentHistorySectionProps {
  versions: SheetVersion[];
  previewedVersionId: string;
  onPreviewVersion: (version: SheetVersion) => void;
  onRestoreVersion: (version: SheetVersion) => void;
}

export function DocumentOutlineSection({ body, headings, onRevealPosition }: DocumentOutlineSectionProps) {
  return (
    <section>
      <h2 className="mb-3 text-[15px] leading-tight font-bold">目录</h2>
      <div className="flex flex-col gap-1">
        {headings.map((heading) => (
          <Button
            key={heading.id}
            type="button"
            variant="ghost"
            className={clsx(
              "h-auto w-full justify-between whitespace-normal py-2 text-left hover:bg-[var(--menu-hover)] active:bg-[var(--menu-selected)]",
              heading.level === 2 && "pl-6",
              heading.level >= 3 && "pl-10",
            )}
            onClick={() => onRevealPosition(positionFromLine(body, heading.line))}
          >
            <span className="min-w-0 truncate">{heading.text}</span>
            <small className="shrink-0 text-xs text-muted-foreground">L{heading.line}</small>
          </Button>
        ))}
        {headings.length === 0 && <p className="mt-2 text-[13px] leading-[1.45] text-muted-foreground">当前文稿还没有 Markdown 标题。</p>}
      </div>
    </section>
  );
}

export function DocumentMediaSection({ images, onRevealPosition }: DocumentMediaSectionProps) {
  return (
    <section>
      <h2 className="mb-3 text-[15px] leading-tight font-bold">媒体</h2>
      <div className="grid grid-cols-2 gap-2.5">
        {images.map((image) => (
          <Button
            key={`${image.index}-${image.path}`}
            type="button"
            variant="outline"
            className="h-20 overflow-hidden p-0 whitespace-normal"
            onClick={() => onRevealPosition(image.index)}
          >
            {image.src ? (
              <img className="size-full object-cover" src={image.src} alt={image.alt || image.label} />
            ) : (
              <span className="p-2 text-xs text-muted-foreground">{image.label}</span>
            )}
          </Button>
        ))}
        {images.length === 0 && <p className="mt-2 text-[13px] leading-[1.45] text-muted-foreground">当前文稿还没有插入图片。</p>}
      </div>
    </section>
  );
}

export function DocumentHistorySection({ versions, previewedVersionId, onPreviewVersion, onRestoreVersion }: DocumentHistorySectionProps) {
  return (
    <section>
      <h2 className="mb-3 text-[15px] leading-tight font-bold">历史版本</h2>
      <div className="flex flex-col gap-1.25">
        {versions.map((version) => {
          const previewing = previewedVersionId === version.id;
          return (
            <article
              key={version.id}
              className={clsx(
                "flex flex-col rounded-lg border bg-card p-2.5 transition-colors",
                previewing ? "border-primary/30 bg-primary/5" : "border-border",
              )}
            >
              <div className="min-w-0">
                <strong className="block truncate text-[13px] font-semibold">{version.title}</strong>
                <small className="mt-0.5 block overflow-hidden text-ellipsis text-[11px] leading-5 text-muted-foreground">
                  {formatSnapshotTime(version.createdAt)} · {version.wordCount} 字
                </small>
                {version.reason && (
                  <small className="mt-0.5 block overflow-hidden text-ellipsis text-[11px] leading-5 text-muted-foreground">
                    {version.reason}
                  </small>
                )}
              </div>
              <div className="mt-2 flex items-center justify-end gap-1.5 border-t border-border/70 pt-2">
                <Button
                  type="button"
                  variant={previewing ? "secondary" : "outline"}
                  size="sm"
                  aria-pressed={previewing}
                  onClick={() => onPreviewVersion(version)}
                >
                  {previewing ? "预览中" : "预览"}
                </Button>
                <Button type="button" size="sm" onClick={() => onRestoreVersion(version)}>
                  恢复
                </Button>
              </div>
            </article>
          );
        })}
        {versions.length === 0 && <p className="mt-2 text-[13px] leading-[1.45] text-muted-foreground">还没有历史版本。</p>}
      </div>
    </section>
  );
}
