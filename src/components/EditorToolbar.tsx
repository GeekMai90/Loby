import clsx from "clsx";
import { ChevronLeft, ChevronRight, Focus, PanelLeftOpen, PanelRightClose, PanelRightOpen } from "lucide-react";
import type { MouseEvent } from "react";
import { APP_SHORTCUTS, appShortcutAriaKeys, appShortcutTitle } from "../lib/keyboardShortcuts";
import type { PublishChannelId } from "../lib/publishing/types";
import { PublishMenu } from "./PublishMenu";

interface EditorToolbarProps {
  inspectorOpen: boolean;
  focusMode: boolean;
  leftSidebarHidden: boolean;
  canNavigateBack: boolean;
  canNavigateForward: boolean;
  canPublish: boolean;
  onExpandLeftSidebar: () => void;
  onToggleFocusMode: () => void;
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
  onExpandLeftSidebar,
  onToggleFocusMode,
  onNavigateBack,
  onNavigateForward,
  onToggleInspector,
  onSelectPublishChannel,
  onWindowToolbarDoubleClick,
}: EditorToolbarProps) {
  return (
    <header className="editor-toolbar" data-tauri-drag-region onDoubleClick={onWindowToolbarDoubleClick}>
      <div className="editor-navigation" aria-label="文稿导航">
        {leftSidebarHidden && (
          <button className="editor-toolbar-button" onClick={onExpandLeftSidebar} title="展开侧边栏" data-no-window-drag>
            <PanelLeftOpen size={18} />
          </button>
        )}
        <button
          className="editor-toolbar-button"
          onClick={onNavigateBack}
          title={appShortcutTitle("previousSheet", "上一篇文稿")}
          aria-keyshortcuts={appShortcutAriaKeys(APP_SHORTCUTS.previousSheet)}
          disabled={!canNavigateBack}
          data-no-window-drag
        >
          <ChevronLeft size={18} />
        </button>
        <button
          className="editor-toolbar-button"
          onClick={onNavigateForward}
          title={appShortcutTitle("nextSheet", "下一篇文稿")}
          aria-keyshortcuts={appShortcutAriaKeys(APP_SHORTCUTS.nextSheet)}
          disabled={!canNavigateForward}
          data-no-window-drag
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="editor-toolbar-spacer" />

      <div className="editor-toolbar-actions">
        <PublishMenu disabled={!canPublish} onSelectChannel={onSelectPublishChannel} />

        <button
          className={clsx("editor-toolbar-button", focusMode && "active")}
          onClick={onToggleFocusMode}
          title={appShortcutTitle("toggleFocusMode", focusMode ? "退出专注模式" : "专注模式")}
          aria-keyshortcuts={appShortcutAriaKeys(APP_SHORTCUTS.toggleFocusMode)}
          data-no-window-drag
        >
          <Focus size={18} />
        </button>

        <button
          className={clsx("editor-toolbar-button", inspectorOpen && "active")}
          onClick={onToggleInspector}
          title={appShortcutTitle("toggleInspector", inspectorOpen ? "隐藏 AI 面板" : "显示 AI 面板")}
          aria-keyshortcuts={appShortcutAriaKeys(APP_SHORTCUTS.toggleInspector)}
          data-no-window-drag
        >
          {inspectorOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
        </button>
      </div>
    </header>
  );
}
