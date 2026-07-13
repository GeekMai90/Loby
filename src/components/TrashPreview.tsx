import { FileText, FolderArchive, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TrashEntry } from "../types";

interface TrashPreviewProps {
  entry: TrashEntry;
  busy: boolean;
  onRestore: () => void;
  onDeletePermanently: () => void;
}

export function TrashPreview({ entry, busy, onRestore, onDeletePermanently }: TrashPreviewProps) {
  const deletedAt = entry.deletedAt ? new Date(entry.deletedAt * 1000).toLocaleString("zh-CN") : "未知时间";
  const EntryIcon = entry.kind === "project" ? FolderArchive : FileText;

  return (
    <section className="mx-auto mt-19 mb-12 w-[min(760px,calc(100%-72px))] text-foreground">
      <header className="flex items-start gap-3 border-b border-border pb-4.5">
        <EntryIcon size={20} />
        <div>
          <h1 className="m-0 text-2xl font-bold">{entry.title}</h1>
          <p className="mt-1 text-[13px] leading-6 text-muted-foreground">
            {entry.kind === "project" ? "项目" : "文稿"} · {deletedAt} 移入废纸篓
          </p>
        </div>
      </header>

      <dl className="my-4.5 grid gap-2">
        {entry.projectTitle && (
          <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2.5 text-xs leading-5">
            <dt className="text-muted-foreground">原项目</dt>
            <dd className="m-0 [overflow-wrap:anywhere] text-muted-foreground">{entry.projectTitle}</dd>
          </div>
        )}
        <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2.5 text-xs leading-5">
          <dt className="text-muted-foreground">原位置</dt>
          <dd className="m-0 [overflow-wrap:anywhere] text-muted-foreground">{entry.originalPath}</dd>
        </div>
      </dl>

      {entry.kind === "document" && (
        <div className="max-h-[min(52vh,560px)] overflow-auto border-y border-border py-4.5">
          <pre className="m-0 whitespace-pre-wrap text-[15px] leading-7 text-foreground">{entry.body || "这篇文稿没有正文内容。"}</pre>
        </div>
      )}

      {entry.kind === "project" && (
        <p className="mt-1 text-[13px] leading-6 text-muted-foreground">恢复项目后，其分组、文稿、素材和元信息会一起回到写作库。</p>
      )}

      <footer className="mt-5 flex items-center gap-2">
        <Button type="button" variant="outline" disabled={busy} onClick={onRestore}>
          <RotateCcw /> 恢复
        </Button>
        <Button type="button" variant="destructive" disabled={busy} onClick={onDeletePermanently}>
          <Trash2 /> 永久删除
        </Button>
      </footer>
    </section>
  );
}
