import { convertFileSrc } from "@tauri-apps/api/core";
import { ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatBytes } from "../lib/formatters";
import type { UnusedImageCandidate } from "../types";

interface UnusedImageCleanupDialogProps {
  open: boolean;
  candidates: UnusedImageCandidate[];
  selectedPaths: Set<string>;
  busy: boolean;
  onClose: () => void;
  onTogglePath: (path: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
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
  onConfirm,
}: UnusedImageCleanupDialogProps) {
  const selected = candidates.filter((candidate) => selectedPaths.has(candidate.path));
  const selectedBytes = selected.reduce((total, candidate) => total + candidate.sizeBytes, 0);
  const allSelected = candidates.length > 0 && selected.length === candidates.length;
  const partiallySelected = selected.length > 0 && !allSelected;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-h-[min(780px,calc(100vh-48px))] gap-0 overflow-hidden p-0 sm:max-w-[min(760px,calc(100vw-48px))]">
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

        <div className="grid max-h-[52vh] grid-cols-2 gap-3 overflow-auto px-6 py-4 sm:grid-cols-3">
          {candidates.map((candidate, index) => {
            const checkboxId = `unused-image-${index}`;
            const checked = selectedPaths.has(candidate.path);
            return (
              <div key={candidate.path} className="overflow-hidden rounded-xl border border-border bg-muted/20">
                <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                  <img src={convertFileSrc(candidate.path)} alt="" loading="lazy" className="size-full object-cover" />
                  <div className="absolute top-2 left-2 rounded-md bg-background/90 p-1 shadow-sm backdrop-blur">
                    <Checkbox
                      id={checkboxId}
                      checked={checked}
                      disabled={busy}
                      aria-label={`选择图片 ${candidate.name}`}
                      onCheckedChange={(nextChecked) => onTogglePath(candidate.path, nextChecked === true)}
                    />
                  </div>
                </div>
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
