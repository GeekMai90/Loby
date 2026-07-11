import { X } from "lucide-react";
import { useEffect } from "react";
import { APP_SHORTCUT_GROUPS, APP_SHORTCUT_LIST, formatAppShortcut } from "../lib/keyboardShortcuts";

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsDialog({ open, onClose }: KeyboardShortcutsDialogProps) {
  useEffect(() => {
    if (!open) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="modal-backdrop shortcuts-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="keyboard-shortcuts-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="keyboard-shortcuts-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <h2 id="keyboard-shortcuts-title">键盘快捷键</h2>
            <p>常用操作集中在这里；以后新增快捷键也会自动出现在此处。</p>
          </div>
          <button type="button" className="icon-button" title="关闭快捷键" onClick={onClose}>
            <X size={17} />
          </button>
        </header>

        <div className="keyboard-shortcuts-groups">
          {APP_SHORTCUT_GROUPS.map((group) => {
            const shortcuts = APP_SHORTCUT_LIST.filter((shortcut) => shortcut.group === group.id);
            return (
              <section key={group.id} className="keyboard-shortcuts-group">
                <h3>{group.title}</h3>
                <div>
                  {shortcuts.map((shortcut) => (
                    <div key={shortcut.id} className="keyboard-shortcut-row">
                      <span>
                        <strong>{shortcut.title}</strong>
                        <small>{shortcut.description}</small>
                      </span>
                      <kbd>{formatAppShortcut(shortcut)}</kbd>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </section>
    </div>
  );
}
