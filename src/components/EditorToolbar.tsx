import clsx from "clsx";
import { ChevronLeft, ChevronRight, Focus, PanelLeftOpen, PanelRightClose, PanelRightOpen } from "lucide-react";
import type { MouseEvent } from "react";

interface EditorToolbarProps {
  inspectorOpen: boolean;
  focusMode: boolean;
  leftSidebarHidden: boolean;
  canNavigateBack: boolean;
  canNavigateForward: boolean;
  onExpandLeftSidebar: () => void;
  onToggleFocusMode: () => void;
  onNavigateBack: () => void;
  onNavigateForward: () => void;
  onToggleInspector: () => void;
  onWindowToolbarDoubleClick: (event: MouseEvent<HTMLElement>) => void;
}

export function EditorToolbar({
  inspectorOpen,
  focusMode,
  leftSidebarHidden,
  canNavigateBack,
  canNavigateForward,
  onExpandLeftSidebar,
  onToggleFocusMode,
  onNavigateBack,
  onNavigateForward,
  onToggleInspector,
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
          title="上一张文稿"
          disabled={!canNavigateBack}
          data-no-window-drag
        >
          <ChevronLeft size={18} />
        </button>
        <button
          className="editor-toolbar-button"
          onClick={onNavigateForward}
          title="下一张文稿"
          disabled={!canNavigateForward}
          data-no-window-drag
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="editor-toolbar-spacer" />

      <div className="editor-toolbar-actions">
        <button
          className={clsx("editor-toolbar-button", focusMode && "active")}
          onClick={onToggleFocusMode}
          title={focusMode ? "退出专注模式" : "专注模式"}
          data-no-window-drag
        >
          <Focus size={18} />
        </button>

        <button
          className={clsx("editor-toolbar-button", inspectorOpen && "active")}
          onClick={onToggleInspector}
          title={inspectorOpen ? "隐藏右侧边栏" : "显示右侧边栏"}
          data-no-window-drag
        >
          {inspectorOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
        </button>
      </div>
    </header>
  );
}
