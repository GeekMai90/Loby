/**
 * [INPUT]: 依赖 shadcn/ui 按钮与点击菜单、lucide-react、shared 主题/快捷键契约及 app 注入的帮助与更新动作
 * [OUTPUT]: 对外提供 LibraryRailFooter
 * [POS]: 写作库导航的稳定底部工具条与更新提醒；只投影帮助/更新状态，不执行网络检查、安装或跨功能导航
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AnimatePresence } from "motion/react";
import { BookOpen, CircleHelp, Download, Keyboard, LoaderCircle, RefreshCw, RotateCw, Settings, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import type { ResolvedAppTheme } from "@/shared/types";
import { APP_SHORTCUTS, appShortcutAriaKeys, formatAppShortcut } from "@/shared/lib/keyboardShortcuts";
import { ThemeModeSwitch } from "@/shared/components/ThemeModeSwitch";
import { UpdateNoticeCard } from "@/features/library/components/UpdateNoticeCard";

interface LibraryRailFooterProps {
  resolvedAppTheme: ResolvedAppTheme;
  updateAvailable: boolean;
  updateBusy: boolean;
  updateInstalling: boolean;
  updateProgress: number | null;
  availableVersion: string;
  onOpenSettings: () => void;
  onOpenNewFeatures: () => void;
  onOpenKeyboardShortcuts: () => void;
  onOpenHelp: () => void;
  onCheckForUpdates: () => void;
  onInstallUpdate: () => void;
  onTemporaryAppThemeChange: (theme: ResolvedAppTheme) => void;
}

export function LibraryRailFooter({
  resolvedAppTheme,
  updateAvailable,
  updateBusy,
  updateInstalling,
  updateProgress,
  availableVersion,
  onOpenSettings,
  onOpenNewFeatures,
  onOpenKeyboardShortcuts,
  onOpenHelp,
  onCheckForUpdates,
  onInstallUpdate,
  onTemporaryAppThemeChange,
}: LibraryRailFooterProps) {
  const updateTitle = updateInstalling
    ? "重启安装更新"
    : updateBusy
      ? updateProgress === null
        ? "正在下载更新"
        : `正在下载更新（${updateProgress}%）`
      : availableVersion
        ? `下载并安装落笔 ${availableVersion}`
        : "下载并安装更新";
  const [updateNoticeDismissed, setUpdateNoticeDismissed] = useState(false);

  useEffect(() => {
    if (!updateAvailable) {
      setUpdateNoticeDismissed(false);
    }
  }, [updateAvailable]);

  return (
    <div className="flex shrink-0 flex-col gap-1.5">
      <AnimatePresence initial={false}>
        {updateAvailable && !updateNoticeDismissed ? (
          <UpdateNoticeCard
            key="update-notice"
            updateBusy={updateBusy}
            updateInstalling={updateInstalling}
            updateProgress={updateProgress}
            onInstallUpdate={onInstallUpdate}
            onDismiss={() => setUpdateNoticeDismissed(true)}
          />
        ) : null}
      </AnimatePresence>

      <div className="relative flex items-center gap-1 border-t border-[var(--sidebar-stroke)] py-1.5">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="设置"
          aria-keyshortcuts={appShortcutAriaKeys(APP_SHORTCUTS.openSettings)}
          title={`设置（${formatAppShortcut(APP_SHORTCUTS.openSettings)}）`}
          onClick={onOpenSettings}
        >
          <Settings className="size-3.5" />
        </Button>
        <ThemeModeSwitch theme={resolvedAppTheme} onChange={onTemporaryAppThemeChange} />
        {updateAvailable ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="ml-auto text-primary hover:text-primary"
            aria-label={updateTitle}
            title={updateTitle}
            disabled={updateBusy && !updateInstalling}
            data-update-available="true"
            onClick={onInstallUpdate}
          >
            {updateInstalling ? (
              <RotateCw className="size-3.5" />
            ) : updateBusy ? (
              <LoaderCircle className="size-3.5 animate-spin" />
            ) : (
              <Download className="size-3.5" />
            )}
          </Button>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon-sm" className="ml-auto" aria-label="帮助" title="帮助">
                <CircleHelp className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" sideOffset={4} className="w-40">
              <DropdownMenuItem onSelect={onOpenNewFeatures}>
                <Sparkles />
                新功能
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onOpenKeyboardShortcuts}>
                <Keyboard />
                键盘快捷键
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onOpenHelp}>
                <BookOpen />
                帮助
              </DropdownMenuItem>
              <DropdownMenuItem disabled={updateBusy} onSelect={onCheckForUpdates}>
                {updateBusy ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
                {updateBusy ? "正在检查更新" : "检查更新"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
