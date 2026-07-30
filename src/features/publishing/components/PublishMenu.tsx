/**
 * [INPUT]: 依赖 shadcn/ui 基础控件、lucide-react、React 运行时、发布模块、shared 公共契约
 * [OUTPUT]: 对外提供 PublishMenu
 * [POS]: 发布 feature 的界面组合单元，连接 发布 状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { SquareArrowOutUpRight } from "lucide-react";
import { useState } from "react";
import { githubPublishChannel, PUBLISH_CHANNELS, type PublishChannelId } from "@/features/publishing/model/types";
import type { PublishingTarget } from "@/features/publishing/model/publishingTargets";

interface PublishMenuProps {
  disabled?: boolean;
  onSelectChannel: (channel: PublishChannelId, targetId?: string) => void;
  githubPublishingTarget?: PublishingTarget;
}

export function PublishMenu({ disabled = false, onSelectChannel, githubPublishingTarget }: PublishMenuProps) {
  const [open, setOpen] = useState(false);
  const channels = [...PUBLISH_CHANNELS, ...(githubPublishingTarget ? [githubPublishChannel(githubPublishingTarget)] : [])];

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" disabled={disabled} title="发布当前文稿" data-no-window-drag>
          <SquareArrowOutUpRight className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="w-40">
        {channels.map((channel) => (
          <DropdownMenuItem
            key={channel.targetId ? `${channel.id}:${channel.targetId}` : channel.id}
            onSelect={() => onSelectChannel(channel.id, channel.targetId)}
          >
            {channel.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
