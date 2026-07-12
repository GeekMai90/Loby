import { Check, ChevronsUpDown, FolderCog, Library, Settings } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { APP_SHORTCUTS, appShortcutAriaKeys, formatAppShortcut } from "../lib/keyboardShortcuts";
import type { WritingLibrary } from "../types";

interface LibrarySwitcherProps {
  libraries: WritingLibrary[];
  activeLibrary?: WritingLibrary;
  onSwitchLibrary: (libraryId: string) => Promise<void> | void;
  onOpenManager: () => void;
  onOpenSettings: () => void;
}

export function LibrarySwitcher({ libraries, activeLibrary, onSwitchLibrary, onOpenManager, onOpenSettings }: LibrarySwitcherProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function closeOnPointerDown(event: MouseEvent) {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }
    window.addEventListener("mousedown", closeOnPointerDown);
    return () => window.removeEventListener("mousedown", closeOnPointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className="library-switcher">
      {open && (
        <div className="library-switcher-menu" role="menu">
          <div className="library-switcher-list">
            {[...libraries]
              .sort((left, right) => right.lastOpenedAt - left.lastOpenedAt)
              .map((library) => (
                <button
                  key={library.id}
                  type="button"
                  className="menu-item"
                  role="menuitemradio"
                  aria-checked={library.id === activeLibrary?.id}
                  onClick={async () => {
                    await onSwitchLibrary(library.id);
                    setOpen(false);
                  }}
                >
                  <Library size={15} className="menu-item-icon" />
                  <span className="library-switcher-menu-name menu-item-label">{library.name}</span>
                  {library.id === activeLibrary?.id && <Check size={15} className="menu-item-check" />}
                </button>
              ))}
          </div>
          <footer>
            <button
              type="button"
              className="menu-item"
              onClick={() => {
                setOpen(false);
                onOpenManager();
              }}
            >
              <FolderCog size={15} className="menu-item-icon" />
              <span className="menu-item-label">管理写作库</span>
            </button>
            <button
              type="button"
              className="menu-item"
              aria-keyshortcuts={appShortcutAriaKeys(APP_SHORTCUTS.openSettings)}
              onClick={() => {
                setOpen(false);
                onOpenSettings();
              }}
            >
              <Settings size={15} className="menu-item-icon" />
              <span className="menu-item-label">设置</span>
              <span className="menu-item-shortcut">{formatAppShortcut(APP_SHORTCUTS.openSettings)}</span>
            </button>
          </footer>
        </div>
      )}

      <button type="button" className="library-switcher-trigger" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <span className="library-switcher-name">{activeLibrary?.name ?? "写作库"}</span>
        <ChevronsUpDown size={14} />
      </button>
    </div>
  );
}
