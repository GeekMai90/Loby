import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronsUpDown, FolderCog, Library, Settings } from "lucide-react";
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
  return (
    <div className="relative shrink-0 border-t border-[var(--sidebar-stroke)] py-1.5">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-between hover:bg-transparent aria-expanded:bg-transparent focus-visible:border-transparent focus-visible:ring-0 dark:hover:bg-transparent"
          >
            <span className="min-w-0 truncate font-normal">{activeLibrary?.name ?? "写作库"}</span>
            <ChevronsUpDown className="text-muted-foreground" size={14} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" sideOffset={6} className="w-44">
          <DropdownMenuRadioGroup value={activeLibrary?.id} onValueChange={(libraryId) => void onSwitchLibrary(libraryId)}>
            {[...libraries]
              .sort((left, right) => right.lastOpenedAt - left.lastOpenedAt)
              .map((library) => (
                <DropdownMenuRadioItem key={library.id} value={library.id}>
                  <Library size={15} />
                  <span className="min-w-0 truncate font-normal">{library.name}</span>
                </DropdownMenuRadioItem>
              ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onOpenManager}>
            <FolderCog size={15} />
            <span>管理写作库</span>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onOpenSettings} aria-keyshortcuts={appShortcutAriaKeys(APP_SHORTCUTS.openSettings)}>
            <Settings size={15} />
            <span>设置</span>
            <DropdownMenuShortcut>{formatAppShortcut(APP_SHORTCUTS.openSettings)}</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
