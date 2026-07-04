import clsx from "clsx";
import {
  Bold,
  ChevronDown,
  ChevronUp,
  Code2,
  FileText,
  Focus,
  Heading1,
  Heading2,
  Italic,
  Library,
  Link,
  List,
  ListTodo,
  Minus,
  PanelRight,
  PenLine,
  Search,
  Sparkles,
  TextQuote,
  ListTree,
} from "lucide-react";
import type { MarkdownFormat } from "../lib/editorMarkdown";
import { countWords } from "../lib/text";
import type { WritingProject, WritingSheet } from "../types";

interface EditorToolbarProps {
  activeProject: WritingProject;
  activeSheet: WritingSheet;
  libraryPath: string;
  libraryStatus: string;
  libraryRailOpen: boolean;
  sheetRailOpen: boolean;
  inspectorOpen: boolean;
  sheetPreviewMode: boolean;
  typewriterMode: boolean;
  onRenameSheet: (title: string) => void;
  onToggleLibraryRail: () => void;
  onToggleSheetRail: () => void;
  onApplyMarkdownFormat: (format: MarkdownFormat) => void;
  onOpenCurrentSheetMarkdown: () => void;
  onOpenEditorSearch: () => void;
  onToggleSheetPreview: () => void;
  onMoveSheet: (direction: -1 | 1) => void;
  onToggleFocusMode: () => void;
  onToggleTypewriterMode: () => void;
  onAskCodex: () => void;
  onToggleInspector: () => void;
}

export function EditorToolbar({
  activeProject,
  activeSheet,
  libraryPath,
  libraryStatus,
  libraryRailOpen,
  sheetRailOpen,
  inspectorOpen,
  sheetPreviewMode,
  typewriterMode,
  onRenameSheet,
  onToggleLibraryRail,
  onToggleSheetRail,
  onApplyMarkdownFormat,
  onOpenCurrentSheetMarkdown,
  onOpenEditorSearch,
  onToggleSheetPreview,
  onMoveSheet,
  onToggleFocusMode,
  onToggleTypewriterMode,
  onAskCodex,
  onToggleInspector,
}: EditorToolbarProps) {
  return (
    <header className="editor-toolbar">
      <div className="toolbar-title">
        <input value={activeSheet.title} onChange={(event) => onRenameSheet(event.target.value)} />
        <span>{countWords(activeSheet.body)} 字 · {activeSheet.status} · {activeProject.targetPlatform}</span>
        <span className="library-path-line">{libraryPath}</span>
        {libraryStatus && <span className="library-status-line">{libraryStatus}</span>}
      </div>

      <div className="toolbar-actions">
        <button
          className={clsx("ghost-button", libraryRailOpen && "active")}
          onClick={onToggleLibraryRail}
          title={libraryRailOpen ? "隐藏项目栏" : "显示项目栏"}
        >
          <Library size={16} /> 项目
        </button>
        <button
          className={clsx("ghost-button", sheetRailOpen && "active")}
          onClick={onToggleSheetRail}
          title={sheetRailOpen ? "隐藏卡片栏" : "显示卡片栏"}
        >
          <ListTree size={16} /> 卡片
        </button>
        {!sheetPreviewMode && (
          <div className="format-toolbar" aria-label="Markdown 快捷格式">
            <button className="icon-button" onClick={() => onApplyMarkdownFormat("h1")} title="一级标题">
              <Heading1 size={16} />
            </button>
            <button className="icon-button" onClick={() => onApplyMarkdownFormat("h2")} title="二级标题">
              <Heading2 size={16} />
            </button>
            <span className="toolbar-divider" />
            <button className="icon-button" onClick={() => onApplyMarkdownFormat("bold")} title="加粗">
              <Bold size={16} />
            </button>
            <button className="icon-button" onClick={() => onApplyMarkdownFormat("italic")} title="斜体">
              <Italic size={16} />
            </button>
            <button className="icon-button" onClick={() => onApplyMarkdownFormat("link")} title="链接">
              <Link size={16} />
            </button>
            <button className="icon-button" onClick={() => onApplyMarkdownFormat("code")} title="行内代码">
              <Code2 size={16} />
            </button>
            <span className="toolbar-divider" />
            <button className="icon-button" onClick={() => onApplyMarkdownFormat("list")} title="无序列表">
              <List size={16} />
            </button>
            <button className="icon-button" onClick={() => onApplyMarkdownFormat("task")} title="任务列表">
              <ListTodo size={16} />
            </button>
            <button className="icon-button" onClick={() => onApplyMarkdownFormat("quote")} title="引用">
              <TextQuote size={16} />
            </button>
            <button className="icon-button" onClick={() => onApplyMarkdownFormat("divider")} title="分割线">
              <Minus size={16} />
            </button>
          </div>
        )}
        <button className="ghost-button" onClick={onOpenCurrentSheetMarkdown} title="打开当前稿件 Markdown 文件">
          <FileText size={16} /> 打开 MD
        </button>
        <button className="ghost-button" onClick={onOpenEditorSearch} title="查找/替换当前稿件" disabled={sheetPreviewMode}>
          <Search size={16} /> 查找/替换
        </button>
        <button
          className={clsx("ghost-button", sheetPreviewMode && "active")}
          onClick={onToggleSheetPreview}
          title={sheetPreviewMode ? "返回编辑" : "预览当前稿件"}
        >
          {sheetPreviewMode ? <PenLine size={16} /> : <FileText size={16} />}
          {sheetPreviewMode ? "编辑" : "预览"}
        </button>
        <button className="ghost-button" onClick={() => onMoveSheet(-1)} title="上移">
          <ChevronUp size={16} />
        </button>
        <button className="ghost-button" onClick={() => onMoveSheet(1)} title="下移">
          <ChevronDown size={16} />
        </button>
        <button className="ghost-button" onClick={onToggleFocusMode} title="专注模式">
          <Focus size={16} /> 专注
        </button>
        <button className={clsx("ghost-button", typewriterMode && "active")} onClick={onToggleTypewriterMode} title="打字机模式">
          <Focus size={16} /> 打字机
        </button>
        <button className="primary-button" onClick={onAskCodex}>
          <Sparkles size={16} /> 询问 Codex
        </button>
        <button
          className={clsx("ghost-button", inspectorOpen && "active")}
          onClick={onToggleInspector}
          title={inspectorOpen ? "隐藏检查器" : "显示检查器"}
        >
          <PanelRight size={16} />
        </button>
      </div>
    </header>
  );
}
