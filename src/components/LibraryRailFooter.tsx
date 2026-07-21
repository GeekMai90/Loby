import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { APP_SHORTCUTS, appShortcutAriaKeys, formatAppShortcut } from "../lib/keyboardShortcuts";

interface LibraryRailFooterProps {
  onOpenSettings: () => void;
}

export function LibraryRailFooter({ onOpenSettings }: LibraryRailFooterProps) {
  return (
    <div className="relative shrink-0 border-t border-[var(--sidebar-stroke)] py-1.5">
      <Button
        type="button"
        variant="ghost"
        className="w-full justify-start gap-2 font-normal hover:bg-transparent focus-visible:border-transparent focus-visible:ring-0 dark:hover:bg-transparent"
        aria-keyshortcuts={appShortcutAriaKeys(APP_SHORTCUTS.openSettings)}
        title={`设置（${formatAppShortcut(APP_SHORTCUTS.openSettings)}）`}
        onClick={onOpenSettings}
      >
        <Settings size={15} />
        <span>设置</span>
      </Button>
    </div>
  );
}
