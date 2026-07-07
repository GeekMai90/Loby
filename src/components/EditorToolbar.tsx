import clsx from "clsx";
import { ChevronLeft, ChevronRight, ImagePlus, PanelRightClose, PanelRightOpen } from "lucide-react";

interface EditorToolbarProps {
  inspectorOpen: boolean;
  canNavigateBack: boolean;
  canNavigateForward: boolean;
  canInsertImage: boolean;
  imageStatus: string;
  onNavigateBack: () => void;
  onNavigateForward: () => void;
  onInsertImage: () => void;
  onToggleInspector: () => void;
}

export function EditorToolbar({
  inspectorOpen,
  canNavigateBack,
  canNavigateForward,
  canInsertImage,
  imageStatus,
  onNavigateBack,
  onNavigateForward,
  onInsertImage,
  onToggleInspector,
}: EditorToolbarProps) {
  return (
    <header className="editor-toolbar" data-tauri-drag-region>
      <div className="editor-navigation" aria-label="文稿导航">
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

      {imageStatus && <span className="editor-toolbar-status">{imageStatus}</span>}

      <button
        className="editor-toolbar-button"
        onClick={onInsertImage}
        title="插入图片"
        disabled={!canInsertImage}
        data-no-window-drag
      >
        <ImagePlus size={18} />
      </button>

      <button
        className={clsx("editor-toolbar-button", inspectorOpen && "active")}
        onClick={onToggleInspector}
        title={inspectorOpen ? "隐藏右侧边栏" : "显示右侧边栏"}
        data-no-window-drag
      >
        {inspectorOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
      </button>
    </header>
  );
}
