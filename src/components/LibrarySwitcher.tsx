import { Check, ChevronsUpDown, FolderCog, Library, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { WritingLibrary } from "../types";

interface LibrarySwitcherProps {
  libraries: WritingLibrary[];
  activeLibrary?: WritingLibrary;
  status: string;
  onSwitchLibrary: (libraryId: string) => Promise<void> | void;
  onOpenManager: () => void;
}

export function LibrarySwitcher({ libraries, activeLibrary, status, onSwitchLibrary, onOpenManager }: LibrarySwitcherProps) {
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
          <header>
            <span>写作库</span>
            <small>{libraries.length} 个</small>
          </header>
          <div className="library-switcher-list">
            {[...libraries]
              .sort((left, right) => right.lastOpenedAt - left.lastOpenedAt)
              .map((library) => (
                <button
                  key={library.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={library.id === activeLibrary?.id}
                  onClick={async () => {
                    await onSwitchLibrary(library.id);
                    setOpen(false);
                  }}
                >
                  <Library size={15} />
                  <span>
                    <strong>{library.name}</strong>
                    <small>{library.path}</small>
                  </span>
                  {library.id === activeLibrary?.id && <Check size={15} />}
                </button>
              ))}
          </div>
          <footer>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onOpenManager();
              }}
            >
              <Plus size={15} /> 新建或打开写作库
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onOpenManager();
              }}
            >
              <FolderCog size={15} /> 管理写作库
            </button>
          </footer>
        </div>
      )}

      <button type="button" className="library-switcher-trigger" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <span className="library-switcher-icon">
          <Library size={15} />
        </span>
        <span>
          <strong>{activeLibrary?.name ?? "写作库"}</strong>
          <small>{status || "本地写作库"}</small>
        </span>
        <ChevronsUpDown size={14} />
      </button>
    </div>
  );
}
