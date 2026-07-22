/**
 * [INPUT]: 依赖 lucide-react、React 运行时、shared 公共契约、发布模块
 * [OUTPUT]: 对外提供 EditorToolbar
 * [POS]: 编辑器 feature 的界面组合单元，连接 编辑器 状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { ChevronLeft, ChevronRight, Focus, PanelLeftOpen } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import { APP_SHORTCUTS, appShortcutAriaKeys, appShortcutTitle } from "@/shared/lib/keyboardShortcuts";
import type { PublishChannelId } from "@/features/publishing/model/types";
import { LiquidGlassButton } from "@/shared/components/LiquidGlassButton";
import { PublishMenu } from "@/features/publishing/components/PublishMenu";

interface EditorToolbarProps {
  focusMode: boolean;
  leftSidebarHidden: boolean;
  canNavigateBack: boolean;
  canNavigateForward: boolean;
  canPublish: boolean;
  documentInformationControl?: ReactNode;
  onExpandLeftSidebar: () => void;
  onToggleFocusMode: () => void;
  onNavigateBack: () => void;
  onNavigateForward: () => void;
  onSelectPublishChannel: (channelId: PublishChannelId) => void;
  onWindowToolbarDoubleClick: (event: MouseEvent<HTMLElement>) => void;
}

export function EditorToolbar({
  focusMode,
  leftSidebarHidden,
  canNavigateBack,
  canNavigateForward,
  canPublish,
  documentInformationControl,
  onExpandLeftSidebar,
  onToggleFocusMode,
  onNavigateBack,
  onNavigateForward,
  onSelectPublishChannel,
  onWindowToolbarDoubleClick,
}: EditorToolbarProps) {
  return (
    <header
      className="editor-toolbar absolute inset-x-0 top-0 z-20 flex min-h-14 shrink-0 items-center justify-between gap-3 bg-transparent px-2.5 py-2 isolate"
      data-tauri-drag-region
      onDoubleClick={onWindowToolbarDoubleClick}
    >
      {!focusMode && (
        <div className="inline-flex shrink-0 items-center gap-1.5" aria-label="文稿导航">
          {leftSidebarHidden && (
            <LiquidGlassButton onClick={onExpandLeftSidebar} title="展开侧边栏" data-no-window-drag>
              <PanelLeftOpen size={17} />
            </LiquidGlassButton>
          )}
          <div className="inline-flex items-center gap-1.5" aria-label="文稿前后导航">
            <LiquidGlassButton
              onClick={onNavigateBack}
              title={appShortcutTitle("previousSheet", "上一篇文稿")}
              aria-keyshortcuts={appShortcutAriaKeys(APP_SHORTCUTS.previousSheet)}
              disabled={!canNavigateBack}
              data-no-window-drag
            >
              <ChevronLeft size={17} />
            </LiquidGlassButton>
            <LiquidGlassButton
              onClick={onNavigateForward}
              title={appShortcutTitle("nextSheet", "下一篇文稿")}
              aria-keyshortcuts={appShortcutAriaKeys(APP_SHORTCUTS.nextSheet)}
              disabled={!canNavigateForward}
              data-no-window-drag
            >
              <ChevronRight size={17} />
            </LiquidGlassButton>
          </div>
        </div>
      )}

      <div className="min-w-0 flex-auto" />

      <div className="inline-flex shrink-0 items-center gap-1.5">
        {!focusMode && documentInformationControl}
        {!focusMode && <PublishMenu disabled={!canPublish} onSelectChannel={onSelectPublishChannel} />}

        <LiquidGlassButton
          onClick={onToggleFocusMode}
          title={appShortcutTitle("toggleFocusMode", focusMode ? "退出专注模式" : "专注模式")}
          aria-keyshortcuts={appShortcutAriaKeys(APP_SHORTCUTS.toggleFocusMode)}
          data-no-window-drag
        >
          <Focus size={17} />
        </LiquidGlassButton>
      </div>
    </header>
  );
}
