/**
 * [INPUT]: 依赖 lucide-react、shadcn/ui 基础控件、shared 公共契约
 * [OUTPUT]: 对外提供 EditorVersionPreviewBar
 * [POS]: 编辑器 feature 的界面组合单元，连接 编辑器 状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Eye, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatSnapshotTime } from "@/shared/lib/formatters";
import type { SheetVersion } from "@/shared/types";

interface EditorVersionPreviewBarProps {
  version: SheetVersion;
  onClose: () => void;
  onRestore: () => void;
}

export function EditorVersionPreviewBar({ version, onClose, onRestore }: EditorVersionPreviewBarProps) {
  return (
    <div className="absolute inset-x-0 top-14 z-10 flex min-h-11 items-center justify-between gap-3 border-b border-[var(--separator)] bg-background px-4 py-1.5">
      <div className="flex min-w-0 items-center gap-2 text-xs text-foreground/70" role="status" aria-live="polite">
        <Eye className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
        <span className="truncate">
          正在预览 {formatSnapshotTime(version.createdAt)} 的历史版本 · {version.wordCount} 字
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          返回当前版本
        </Button>
        <Button type="button" size="sm" onClick={onRestore}>
          <RotateCcw aria-hidden="true" />
          恢复此版本
        </Button>
      </div>
    </div>
  );
}
