import { Image, MoonStar, Music2, Paintbrush, Power, Trees } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Switch } from "./ui/switch";
import { ZEN_SOUND_OPTIONS, type ZenModePreferences, type ZenSoundId } from "../lib/zenMode";

interface ZenModeControlMenuProps {
  open: boolean;
  preferences: ZenModePreferences;
  activeSoundLabel: string;
  onOpenChange: (open: boolean) => void;
  onSelectBackgroundImage: () => void;
  onResetPreferences: () => void;
  onSoundEnabledChange: (enabled: boolean) => void;
  onSelectSound: (soundId: ZenSoundId) => void;
  onExit: () => void;
}

export function ZenModeControlMenu({
  open,
  preferences,
  activeSoundLabel,
  onOpenChange,
  onSelectBackgroundImage,
  onResetPreferences,
  onSoundEnabledChange,
  onSelectSound,
  onExit,
}: ZenModeControlMenuProps) {
  return (
    <div className="zen-control-anchor">
      <DropdownMenu open={open} onOpenChange={onOpenChange}>
        <DropdownMenuTrigger asChild>
          <button type="button" className="zen-control-trigger" aria-label="禅模式设置">
            <MoonStar size={20} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="zen-control-menu w-80 p-1.5"
          side="top"
          align="start"
          sideOffset={12}
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <DropdownMenuItem className="zen-control-item" onSelect={onSelectBackgroundImage}>
            <Image />
            <span>背景图像</span>
          </DropdownMenuItem>
          <DropdownMenuItem className="zen-control-item" onSelect={onResetPreferences}>
            <Paintbrush />
            <span>将设置还原成默认</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="zen-control-item"
            onSelect={(event) => {
              event.preventDefault();
              onSoundEnabledChange(!preferences.soundEnabled);
            }}
          >
            <Music2 />
            <span>背景音</span>
            <Switch className="pointer-events-none ml-auto" checked={preferences.soundEnabled} tabIndex={-1} aria-hidden="true" />
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="zen-control-item">
              <Trees />
              <span>背景音</span>
              <span className="ml-auto text-xs text-muted-foreground">{activeSoundLabel}</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="zen-control-menu w-36 p-1.5">
              <DropdownMenuRadioGroup value={preferences.soundId} onValueChange={(value) => onSelectSound(value as ZenSoundId)}>
                {ZEN_SOUND_OPTIONS.map((option) => (
                  <DropdownMenuRadioItem key={option.id} value={option.id} className="min-h-9 px-3">
                    {option.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="zen-control-item" onSelect={onExit}>
            <Power />
            <span>退出禅模式</span>
            <span className="ml-auto text-xs text-muted-foreground">Esc</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
