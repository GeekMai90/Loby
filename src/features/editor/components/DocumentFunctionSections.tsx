/**
 * [INPUT]: 依赖 shared 公共契约、shadcn/ui 基础控件、编辑器模块、clsx
 * [OUTPUT]: 对外提供 DocumentMediaSection、DocumentHistorySection
 * [POS]: 编辑器 feature 的界面组合单元，连接 编辑器 状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { formatSnapshotTime } from "@/shared/lib/formatters";
import { Button } from "@/components/ui/button";
import type { buildDocumentImageItems } from "@/features/editor/model/documentFunctionRail";
import type { SheetVersion } from "@/shared/types";
import clsx from "clsx";

type DocumentImageItem = ReturnType<typeof buildDocumentImageItems>[number];

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
