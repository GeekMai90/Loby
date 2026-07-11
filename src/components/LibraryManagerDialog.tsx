import { Check, FolderOpen, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import type { WritingLibrary } from "../types";
import { LibrarySetupForm } from "./LibrarySetupForm";

interface LibraryManagerDialogProps {
  open: boolean;
  libraries: WritingLibrary[];
  activeLibrary?: WritingLibrary;
  defaultParentPath: string;
  onClose: () => void;
  onChooseParent: () => Promise<string | null>;
  onCreateLibrary: (name: string, parentPath?: string) => Promise<void>;
  onAddExistingLibrary: () => Promise<void>;
  onSwitchLibrary: (libraryId: string) => Promise<void>;
  onRenameLibrary: (libraryId: string, name: string) => void;
  onRemoveLibrary: (libraryId: string) => boolean;
  onOpenLibrary: (libraryId: string) => Promise<void>;
}

export function LibraryManagerDialog({
  open,
  libraries,
  activeLibrary,
  defaultParentPath,
  onClose,
  onChooseParent,
  onCreateLibrary,
  onAddExistingLibrary,
  onSwitchLibrary,
  onRenameLibrary,
  onRemoveLibrary,
  onOpenLibrary,
}: LibraryManagerDialogProps) {
  const [mode, setMode] = useState<"list" | "create">("list");
  const [editingId, setEditingId] = useState("");
  const [editingName, setEditingName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  async function run(task: () => Promise<void>, closeAfter = false) {
    setBusy(true);
    setError("");
    try {
      await task();
      if (closeAfter) onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  function commitRename(library: WritingLibrary) {
    const name = editingName.trim();
    if (name) onRenameLibrary(library.id, name);
    setEditingId("");
  }

  return (
    <div className="modal-backdrop library-manager-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="library-manager-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="library-manager-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="library-manager-header">
          <div>
            <h2 id="library-manager-title">{mode === "create" ? "新建写作库" : "管理写作库"}</h2>
            <p>{mode === "create" ? "创建一个独立的本地写作空间。" : "快速切换、重命名或整理已登记的写作库。"}</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} title="关闭">
            <X size={17} />
          </button>
        </header>

        {mode === "create" ? (
          <div className="library-manager-create">
            <LibrarySetupForm
              defaultParentPath={defaultParentPath}
              submitLabel="创建写作库"
              busy={busy}
              onChooseParent={onChooseParent}
              onSubmit={(name, parentPath) => run(() => onCreateLibrary(name, parentPath), true)}
            />
            <button type="button" className="secondary-button" disabled={busy} onClick={() => setMode("list")}>
              返回列表
            </button>
          </div>
        ) : (
          <>
            <div className="library-manager-actions">
              <button type="button" className="primary-button" onClick={() => setMode("create")}>
                <Plus size={15} /> 新建写作库
              </button>
              <button type="button" className="secondary-button" disabled={busy} onClick={() => run(onAddExistingLibrary, true)}>
                <FolderOpen size={15} /> 打开已有文件夹
              </button>
            </div>
            <div className="library-manager-list">
              {libraries.map((library) => {
                const active = library.id === activeLibrary?.id;
                return (
                  <article key={library.id} className={active ? "active" : ""}>
                    <div className="library-manager-library-copy">
                      {editingId === library.id ? (
                        <input
                          autoFocus
                          value={editingName}
                          onChange={(event) => setEditingName(event.target.value)}
                          onBlur={() => commitRename(library)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") commitRename(library);
                            if (event.key === "Escape") setEditingId("");
                          }}
                        />
                      ) : (
                        <strong>
                          {library.name}{" "}
                          {active && (
                            <span>
                              <Check size={13} /> 当前
                            </span>
                          )}
                        </strong>
                      )}
                      <small>{library.path}</small>
                    </div>
                    <div className="library-manager-row-actions">
                      {!active && (
                        <button type="button" disabled={busy} onClick={() => run(() => onSwitchLibrary(library.id), true)}>
                          切换
                        </button>
                      )}
                      <button type="button" title="在文件管理器中打开" onClick={() => run(() => onOpenLibrary(library.id))}>
                        <FolderOpen size={15} />
                      </button>
                      <button
                        type="button"
                        title="修改显示名称"
                        onClick={() => {
                          setEditingId(library.id);
                          setEditingName(library.name);
                        }}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        className="danger"
                        disabled={active}
                        title={active ? "请先切换到其他写作库" : "仅从列表移除，不会删除文件"}
                        onClick={() => onRemoveLibrary(library.id)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
            <p className="library-manager-note">移除只会清除 Nibva 中的登记记录，不会删除本地文件夹或文稿。</p>
          </>
        )}
        {error && <p className="library-setup-error">{error}</p>}
      </section>
    </div>
  );
}
