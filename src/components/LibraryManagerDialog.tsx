import { getVersion } from "@tauri-apps/api/app";
import { Ellipsis, X } from "lucide-react";
import { useEffect, useState, type MouseEvent as ReactMouseEvent } from "react";
import { createPortal } from "react-dom";
import appIconUrl from "../../src-tauri/icons/128x128.png";
import type { WritingLibrary } from "../types";
import { LibraryManagerCreateForm } from "./LibraryManagerCreateForm";

interface LibraryManagerDialogProps {
  open: boolean;
  libraries: WritingLibrary[];
  activeLibrary?: WritingLibrary;
  onClose: () => void;
  onChooseParent: () => Promise<string | null>;
  onCreateLibrary: (name: string, parentPath?: string) => Promise<void>;
  onAddExistingLibrary: () => Promise<void>;
  onSwitchLibrary: (libraryId: string) => Promise<void>;
  onRenameLibrary: (libraryId: string, name: string) => void;
  onMoveLibrary: (libraryId: string) => Promise<void>;
  onRevealLibrary: (libraryId: string) => Promise<void>;
  onRemoveLibrary: (libraryId: string) => boolean;
}

interface LibraryMenuPosition {
  libraryId: string;
  top: number;
  left: number;
}

export function LibraryManagerDialog({
  open,
  libraries,
  activeLibrary,
  onClose,
  onChooseParent,
  onCreateLibrary,
  onAddExistingLibrary,
  onSwitchLibrary,
  onRenameLibrary,
  onMoveLibrary,
  onRevealLibrary,
  onRemoveLibrary,
}: LibraryManagerDialogProps) {
  const [mode, setMode] = useState<"list" | "create">("list");
  const [editingId, setEditingId] = useState("");
  const [editingName, setEditingName] = useState("");
  const [menuPosition, setMenuPosition] = useState<LibraryMenuPosition | null>(null);
  const [appVersion, setAppVersion] = useState("0.1.0");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      setMode("list");
      setEditingId("");
      setMenuPosition(null);
      setError("");
      return;
    }
    getVersion()
      .then(setAppVersion)
      .catch(() => setAppVersion("0.1.0"));
  }, [open]);

  useEffect(() => {
    if (!menuPosition) return;
    function closeMenu(event: PointerEvent) {
      const target = event.target as Element | null;
      if (target?.closest(".library-manager-more-menu, .library-manager-more-button")) return;
      setMenuPosition(null);
    }
    window.addEventListener("pointerdown", closeMenu, true);
    return () => window.removeEventListener("pointerdown", closeMenu, true);
  }, [menuPosition]);

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

  function openLibraryMenu(event: ReactMouseEvent<HTMLButtonElement>, libraryId: string) {
    const rect = event.currentTarget.getBoundingClientRect();
    const width = 188;
    setMenuPosition((current) =>
      current?.libraryId === libraryId
        ? null
        : {
            libraryId,
            top: Math.min(rect.bottom + 5, window.innerHeight - 150),
            left: Math.min(rect.right - width, window.innerWidth - width - 8),
          },
    );
  }

  const menuLibrary = libraries.find((library) => library.id === menuPosition?.libraryId);

  return (
    <div className="modal-backdrop library-manager-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="library-manager-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="library-manager-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="library-manager-title" className="visually-hidden">
          管理写作库
        </h2>
        <button type="button" className="icon-button library-manager-close" onClick={onClose} title="关闭">
          <X size={17} />
        </button>

        <aside className="library-manager-sidebar">
          <header>
            <strong>写作库</strong>
            <small>{libraries.length} 个本地写作库</small>
          </header>
          <div className="library-manager-list">
            {libraries.map((library) => {
              const active = library.id === activeLibrary?.id;
              return (
                <article key={library.id} className={active ? "active" : ""}>
                  {editingId === library.id ? (
                    <div className="library-manager-library-copy editing">
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
                      <small>{library.path}</small>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="library-manager-library-main"
                      disabled={busy}
                      aria-current={active ? "true" : undefined}
                      onClick={() => {
                        if (!active) void run(() => onSwitchLibrary(library.id), true);
                      }}
                    >
                      <strong>{library.name}</strong>
                      <small>{library.path}</small>
                    </button>
                  )}
                  <button
                    type="button"
                    className="icon-button library-manager-more-button"
                    aria-label={`${library.name}的更多操作`}
                    aria-expanded={menuPosition?.libraryId === library.id}
                    onClick={(event) => openLibraryMenu(event, library.id)}
                  >
                    <Ellipsis size={16} />
                  </button>
                </article>
              );
            })}
          </div>
        </aside>

        <main className="library-manager-main">
          <div className="library-manager-brand">
            <img src={appIconUrl} alt="Nibva 应用图标" />
            <strong>Nibva</strong>
            <span>版本 {appVersion}</span>
          </div>

          <div className="library-manager-action-stage">
            <div className={mode === "create" ? "library-manager-action-track show-create" : "library-manager-action-track"}>
              <section className="library-manager-action-page entry-page" aria-hidden={mode !== "list"}>
                <div className="library-manager-entry-card">
                  <div className="library-manager-entry-row">
                    <div>
                      <strong>新建写作库</strong>
                      <small>在指定文件夹下创建一个新的写作库。</small>
                    </div>
                    <button type="button" className="primary-button" onClick={() => setMode("create")}>
                      创建
                    </button>
                  </div>
                  <div className="library-manager-entry-row">
                    <div>
                      <strong>打开本地写作库</strong>
                      <small>选择已有的本地文件夹并添加到写作库列表。</small>
                    </div>
                    <button type="button" className="secondary-button" disabled={busy} onClick={() => run(onAddExistingLibrary, true)}>
                      打开
                    </button>
                  </div>
                </div>
              </section>
              <section className="library-manager-action-page create-page" aria-hidden={mode !== "create"}>
                <LibraryManagerCreateForm
                  key={mode}
                  busy={busy}
                  onBack={() => setMode("list")}
                  onChooseLocation={onChooseParent}
                  onSubmit={(name, parentPath) => run(() => onCreateLibrary(name, parentPath), true)}
                />
              </section>
            </div>
          </div>
          {error && <p className="library-setup-error library-manager-error">{error}</p>}
        </main>
      </section>

      {menuPosition && menuLibrary
        ? createPortal(
            <div
              className="library-manager-more-menu"
              role="menu"
              style={{ top: menuPosition.top, left: menuPosition.left }}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setEditingId(menuLibrary.id);
                  setEditingName(menuLibrary.name);
                  setMenuPosition(null);
                }}
              >
                重命名写作库
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={busy}
                onClick={() => {
                  setMenuPosition(null);
                  void run(() => onMoveLibrary(menuLibrary.id));
                }}
              >
                移动写作库
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuPosition(null);
                  void run(() => onRevealLibrary(menuLibrary.id));
                }}
              >
                在访达中显示
              </button>
              <div className="library-manager-menu-separator" />
              <button
                type="button"
                role="menuitem"
                className="danger-menu-item"
                disabled={menuLibrary.id === activeLibrary?.id}
                title={menuLibrary.id === activeLibrary?.id ? "请先切换到其他写作库" : "不会删除本地文件"}
                onClick={() => {
                  if (onRemoveLibrary(menuLibrary.id)) setMenuPosition(null);
                }}
              >
                从写作库列表中移除
              </button>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
