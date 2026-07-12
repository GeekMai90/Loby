import { BookOpenText, Check, ChevronDown, FileText, Send, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PUBLISH_CHANNELS, type PublishChannelId } from "../lib/publishing/types";

interface PublishMenuProps {
  disabled?: boolean;
  onSelectChannel: (channel: PublishChannelId) => void;
}

const CHANNEL_ICONS = {
  wechat: FileText,
  wordpress: BookOpenText,
  mowen: Send,
} as const;

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
        className="editor-publish-button"
        disabled={disabled}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        title="发布当前文稿"
      >
        <Share2 size={15} />
        <span>发布</span>
        <ChevronDown size={13} />
      </button>
      {open && (
        <div className="publish-menu-panel" role="menu">
          <header>
            <strong>发布当前文稿</strong>
            <small>选择发布渠道</small>
          </header>
          {PUBLISH_CHANNELS.map((channel) => {
            const Icon = CHANNEL_ICONS[channel.id];
            return (
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
                <span className="publish-channel-icon menu-item-icon">
                  <Icon size={16} />
                </span>
                <span className="menu-item-label">
                  <strong>{channel.label}</strong>
                  <small>{channel.description}</small>
                </span>
                {channel.id === "wechat" && <Check size={14} className="publish-channel-primary menu-item-check" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
