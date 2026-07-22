/**
 * [INPUT]: 依赖 Tauri API、lucide-react、shadcn/ui 基础控件、index.css 媒体选择控件 Token 与 shared 公共契约
 * [OUTPUT]: 对外提供 UnusedImageCleanupDialog
 * [POS]: 写作库 feature 的界面组合单元，连接 写作库 状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { convertFileSrc } from "@tauri-apps/api/core";
import { ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatBytes } from "@/shared/lib/formatters";
import type { UnusedImageCandidate } from "@/shared/types";

interface UnusedImageCleanupDialogProps {
  open: boolean;
  candidates: UnusedImageCandidate[];
  selectedPaths: Set<string>;
  busy: boolean;
  onClose: () => void;
  onTogglePath: (path: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  onPreview: (candidate: UnusedImageCandidate) => void;
  onSaveAs: (candidate: UnusedImageCandidate) => Promise<boolean>;
  onConfirm: () => void;
}

export function UnusedImageCleanupDialog({
  open,
  candidates,
  selectedPaths,
  busy,
  onClose,
  onTogglePath,
  onSelectAll,
  onPreview,
  onSaveAs,
  onConfirm,
}: UnusedImageCleanupDialogProps) {
  const selected = candidates.filter((candidate) => selectedPaths.has(candidate.path));
  const selectedBytes = selected.reduce((total, candidate) => total + candidate.sizeBytes, 0);
  const allSelected = candidates.length > 0 && selected.length === candidates.length;
  const partiallySelected = selected.length > 0 && !allSelected;

  async function saveCandidateAs(candidate: UnusedImageCandidate) {
    if (busy) return;
    await onSaveAs(candidate);
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="h-[min(860px,calc(100vh-32px))] grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-[min(1120px,calc(100vw-32px))]">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>清理未使用的图片</DialogTitle>
          <DialogDescription>
            以下图片未被当前文稿、历史版本或废纸篓文稿引用。取消选择仍需保留的图片，然后移入 Loby 废纸篓。
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between border-y border-border px-6 py-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="unused-images-select-all"
              checked={partiallySelected ? "indeterminate" : allSelected}
              disabled={busy}
              onCheckedChange={(checked) => onSelectAll(checked === true)}
            />
            <label htmlFor="unused-images-select-all" className="text-sm font-medium">
              全选
            </label>
          </div>
          <span className="text-xs text-muted-foreground">
            已选择 {selected.length}/{candidates.length} 张 · {formatBytes(selectedBytes)}
          </span>
        </div>

        <div className="grid min-h-0 grid-cols-[repeat(auto-fill,minmax(200px,1fr))] content-start gap-3 overflow-auto px-6 py-4">
          {candidates.map((candidate, index) => {
            const checkboxId = `unused-image-${index}`;
            const checked = selectedPaths.has(candidate.path);
            return (
              <div key={candidate.path} className="overflow-hidden rounded-xl border border-border bg-muted/20">
                <ContextMenu modal={false}>
                  <ContextMenuTrigger asChild>
                    <div
                      className="relative aspect-[4/3] cursor-zoom-in overflow-hidden bg-muted"
                      title="双击放大，右键可另存为"
                      onDoubleClick={() => onPreview(candidate)}
                    >
                      <img
                        src={convertFileSrc(candidate.path)}
                        alt={candidate.name}
                        loading="lazy"
                        draggable={false}
                        className="size-full object-cover"
                      />
                      <Checkbox
                        id={checkboxId}
                        checked={checked}
                        disabled={busy}
                        className="absolute top-2 left-2 size-5 border-[var(--media-selection-control-border)] bg-background/95 shadow-md"
                        aria-label={`选择图片 ${candidate.name}`}
                        onDoubleClick={(event) => event.stopPropagation()}
                        onCheckedChange={(nextChecked) => onTogglePath(candidate.path, nextChecked === true)}
                      />
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-36">
                    <ContextMenuItem disabled={busy} onSelect={() => void saveCandidateAs(candidate)}>
                      另存为...
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
                <label htmlFor={checkboxId} className="flex cursor-pointer items-start gap-2 px-3 py-2.5">
                  <ImageIcon size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0">
                    <strong className="block truncate text-xs font-medium" title={candidate.name}>
                      {candidate.name}
                    </strong>
                    <small className="mt-0.5 block text-[11px] text-muted-foreground">{formatBytes(candidate.sizeBytes)}</small>
                  </span>
                </label>
              </div>
            );
          })}
        </div>

        <DialogFooter className="px-6 pt-2 pb-6">
          <Button variant="outline" disabled={busy} onClick={onClose}>
            取消
          </Button>
          <Button variant="destructive" disabled={busy || selected.length === 0} onClick={onConfirm}>
            {busy ? "正在清理..." : `将 ${selected.length} 张图片移入废纸篓`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
