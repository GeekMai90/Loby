import { SquareArrowOutUpRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PUBLISH_CHANNELS, type PublishChannelId } from "../lib/publishing/types";

interface PublishMenuProps {
  disabled?: boolean;
  onSelectChannel: (channel: PublishChannelId) => void;
}

export function PublishMenu({ disabled = false, onSelectChannel }: PublishMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function closeMenu(event: MouseEvent) {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }
    window.addEventListener("mousedown", closeMenu);
    return () => window.removeEventListener("mousedown", closeMenu);
  }, [open]);

  return (
    <div ref={rootRef} className="publish-menu-root" data-no-window-drag>
      <button
        type="button"
        className={open ? "editor-toolbar-button active" : "editor-toolbar-button"}
        disabled={disabled}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        title="发布当前文稿"
      >
        <SquareArrowOutUpRight size={18} />
      </button>
      {open && (
        <div className="publish-menu-panel" role="menu">
          {PUBLISH_CHANNELS.map((channel) => (
            <button
              key={channel.id}
              type="button"
              className="menu-item"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onSelectChannel(channel.id);
              }}
            >
              <span className="menu-item-label">{channel.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
