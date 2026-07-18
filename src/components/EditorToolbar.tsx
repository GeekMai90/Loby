import { ChevronLeft, ChevronRight, Focus, MoonStar, PanelLeftOpen, PanelRightClose, PanelRightOpen } from "lucide-react";
import type { MouseEvent } from "react";
import { APP_SHORTCUTS, appShortcutAriaKeys, appShortcutTitle } from "../lib/keyboardShortcuts";
import type { PublishChannelId } from "../lib/publishing/types";
import { LiquidGlassButton, LiquidGlassButtonGroup } from "./LiquidGlassButton";
import { PublishMenu } from "./PublishMenu";

interface EditorToolbarProps {
  inspectorOpen: boolean;
  focusMode: boolean;
  leftSidebarHidden: boolean;
  canNavigateBack: boolean;
  canNavigateForward: boolean;
  canPublish: boolean;
  canEnterZenMode: boolean;
  zenModeBusy: boolean;
  onExpandLeftSidebar: () => void;
  onToggleFocusMode: () => void;
  onEnterZenMode: () => void;
  onNavigateBack: () => void;
  onNavigateForward: () => void;
  onToggleInspector: () => void;
  onSelectPublishChannel: (channelId: PublishChannelId) => void;
  onWindowToolbarDoubleClick: (event: MouseEvent<HTMLElement>) => void;
}

export function EditorToolbar({
  inspectorOpen,
  focusMode,
  leftSidebarHidden,
  canNavigateBack,
  canNavigateForward,
  canPublish,
  canEnterZenMode,
  zenModeBusy,
  onExpandLeftSidebar,
  onToggleFocusMode,
  onEnterZenMode,
  onNavigateBack,
  onNavigateForward,
  onToggleInspector,
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
          <LiquidGlassButtonGroup aria-label="文稿前后导航">
            <LiquidGlassButton
              joined
              onClick={onNavigateBack}
              title={appShortcutTitle("previousSheet", "上一篇文稿")}
              aria-keyshortcuts={appShortcutAriaKeys(APP_SHORTCUTS.previousSheet)}
              disabled={!canNavigateBack}
              data-no-window-drag
            >
              <ChevronLeft size={17} />
            </LiquidGlassButton>
            <LiquidGlassButton
              joined
              onClick={onNavigateForward}
              title={appShortcutTitle("nextSheet", "下一篇文稿")}
              aria-keyshortcuts={appShortcutAriaKeys(APP_SHORTCUTS.nextSheet)}
              disabled={!canNavigateForward}
              data-no-window-drag
            >
              <ChevronRight size={17} />
            </LiquidGlassButton>
          </LiquidGlassButtonGroup>
        </div>
      )}

      <div className="min-w-0 flex-auto" />

      <div className="inline-flex shrink-0 items-center gap-1.5">
        {!focusMode && <PublishMenu disabled={!canPublish} onSelectChannel={onSelectPublishChannel} />}

        <LiquidGlassButton
          active={focusMode}
          onClick={onToggleFocusMode}
          title={appShortcutTitle("toggleFocusMode", focusMode ? "退出专注模式" : "专注模式")}
          aria-keyshortcuts={appShortcutAriaKeys(APP_SHORTCUTS.toggleFocusMode)}
          data-no-window-drag
        >
          <Focus size={17} />
        </LiquidGlassButton>

        {!focusMode && (
          <>
            <LiquidGlassButton
              onClick={onEnterZenMode}
              title={appShortcutTitle("enterZenMode", "进入禅模式")}
              aria-keyshortcuts={appShortcutAriaKeys(APP_SHORTCUTS.enterZenMode)}
              disabled={!canEnterZenMode || zenModeBusy}
              data-no-window-drag
            >
              <MoonStar size={17} />
            </LiquidGlassButton>

            <LiquidGlassButton
              active={inspectorOpen}
              onClick={onToggleInspector}
              title={appShortcutTitle("toggleInspector", inspectorOpen ? "隐藏 AI 面板" : "显示 AI 面板")}
              aria-keyshortcuts={appShortcutAriaKeys(APP_SHORTCUTS.toggleInspector)}
              data-no-window-drag
            >
              {inspectorOpen ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}
            </LiquidGlassButton>
          </>
        )}
      </div>
    </header>
  );
}
