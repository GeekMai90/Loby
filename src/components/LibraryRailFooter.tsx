import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import type { AppThemePreference } from "../types";
import { APP_SHORTCUTS, appShortcutAriaKeys, formatAppShortcut } from "../lib/keyboardShortcuts";
import { ThemeModeSwitch } from "./ThemeModeSwitch";

interface LibraryRailFooterProps {
  appTheme: AppThemePreference;
  onOpenSettings: () => void;
  onAppThemeChange: (theme: AppThemePreference) => void;
}

export function LibraryRailFooter({ appTheme, onOpenSettings, onAppThemeChange }: LibraryRailFooterProps) {
  return (
    <div className="relative flex shrink-0 items-center gap-1 border-t border-[var(--sidebar-stroke)] py-1.5">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="hover:bg-transparent dark:hover:bg-transparent"
        aria-label="设置"
        aria-keyshortcuts={appShortcutAriaKeys(APP_SHORTCUTS.openSettings)}
        title={`设置（${formatAppShortcut(APP_SHORTCUTS.openSettings)}）`}
        onClick={onOpenSettings}
      >
        <Settings />
      </Button>
      <ThemeModeSwitch theme={appTheme} onChange={onAppThemeChange} />
    </div>
  );
}
