import { FileText, FolderArchive, RotateCcw, Trash2 } from "lucide-react";
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
    <section className="trash-preview">
      <header>
        <EntryIcon size={20} />
        <div>
          <h1>{entry.title}</h1>
          <p>
            {entry.kind === "project" ? "项目" : "文稿"} · {deletedAt} 移入废纸篓
          </p>
        </div>
      </header>

      <dl>
        {entry.projectTitle && (
          <div>
            <dt>原项目</dt>
            <dd>{entry.projectTitle}</dd>
          </div>
        )}
        <div>
          <dt>原位置</dt>
          <dd>{entry.originalPath}</dd>
        </div>
      </dl>

      {entry.kind === "document" && (
        <div className="trash-document-body">
          <pre>{entry.body || "这篇文稿没有正文内容。"}</pre>
        </div>
      )}

      {entry.kind === "project" && <p className="trash-project-note">恢复项目后，其分组、文稿、素材和元信息会一起回到写作库。</p>}

      <footer>
        <button type="button" className="secondary-button" disabled={busy} onClick={onRestore}>
          <RotateCcw size={15} /> 恢复
        </button>
        <button type="button" className="trash-delete-button" disabled={busy} onClick={onDeletePermanently}>
          <Trash2 size={15} /> 永久删除
        </button>
      </footer>
    </section>
  );
}
