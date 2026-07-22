/**
 * [INPUT]: 依赖 shadcn/ui 基础控件、lucide-react、shared 公共契约
 * [OUTPUT]: 对外提供 LibraryRailFooter
 * [POS]: 写作库 feature 的界面组合单元，连接 写作库 状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import type { ResolvedAppTheme } from "@/shared/types";
import { APP_SHORTCUTS, appShortcutAriaKeys, formatAppShortcut } from "@/shared/lib/keyboardShortcuts";
import { ThemeModeSwitch } from "@/shared/components/ThemeModeSwitch";

interface LibraryRailFooterProps {
  resolvedAppTheme: ResolvedAppTheme;
  onOpenSettings: () => void;
  onTemporaryAppThemeChange: (theme: ResolvedAppTheme) => void;
}

export function LibraryRailFooter({ resolvedAppTheme, onOpenSettings, onTemporaryAppThemeChange }: LibraryRailFooterProps) {
  return (
    <div className="relative flex shrink-0 items-center gap-1 border-t border-[var(--sidebar-stroke)] py-1.5">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        surface="transparent"
        aria-label="设置"
        aria-keyshortcuts={appShortcutAriaKeys(APP_SHORTCUTS.openSettings)}
        title={`设置（${formatAppShortcut(APP_SHORTCUTS.openSettings)}）`}
        onClick={onOpenSettings}
      >
        <Settings />
      </Button>
      <ThemeModeSwitch theme={resolvedAppTheme} onChange={onTemporaryAppThemeChange} />
    </div>
  );
}
