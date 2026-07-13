import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SquareArrowOutUpRight } from "lucide-react";
import { useState } from "react";
import { PUBLISH_CHANNELS, type PublishChannelId } from "../lib/publishing/types";
import { LiquidGlassButton } from "./LiquidGlassButton";

interface PublishMenuProps {
  disabled?: boolean;
  onSelectChannel: (channel: PublishChannelId) => void;
}

export function PublishMenu({ disabled = false, onSelectChannel }: PublishMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <LiquidGlassButton active={open} disabled={disabled} title="发布当前文稿" data-no-window-drag>
          <SquareArrowOutUpRight size={17} />
        </LiquidGlassButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="w-40">
        {PUBLISH_CHANNELS.map((channel) => (
          <DropdownMenuItem key={channel.id} onSelect={() => onSelectChannel(channel.id)}>
            {channel.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
