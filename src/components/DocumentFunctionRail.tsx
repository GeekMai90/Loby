import { useEffect, useMemo, useRef, useState, type MouseEvent, type WheelEvent } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  CircleX,
  Clock3,
  FileText,
  Folder,
  ImageIcon,
  List,
  Search,
  type LucideIcon,
} from "lucide-react";
import clsx from "clsx";
import { formatSnapshotTime } from "../lib/formatters";
import { parseImageReferences, resolveSheetImageSourcePath, stripExtension, getBasename } from "../lib/imageAssets";
import { getSheetHeadings } from "../lib/markdownOutline";
import type { SheetVersion, WritingProject, WritingSheet } from "../types";

type DocumentRailTab = "outline" | "media" | "search" | "history";
type SearchMode = "find" | "replace";

interface SearchResultItem {
  id: string;
  index: number;
  line: number;
  before: string;
  match: string;
  after: string;
}

interface DocumentFunctionRailProps {
  project: WritingProject;
  sheet: WritingSheet;
  libraryPath: string;
  onToggleMode: () => void;
  railModeSwitchExpanded: boolean;
  onRailModeSwitchExpandedChange: (expanded: boolean) => void;
  onWindowDragStart: (event: MouseEvent<HTMLElement>) => void;
  onWindowToolbarDoubleClick: (event: MouseEvent<HTMLElement>) => void;
  onRailWheel: (event: WheelEvent<HTMLElement>) => void;
  onRevealPosition: (position: number) => void;
  onReplaceBody: (body: string) => void;
  onRestoreVersion: (version: SheetVersion) => void;
}

const DOCUMENT_TABS: Array<{ id: DocumentRailTab; label: string; icon: LucideIcon }> = [
  { id: "outline", label: "目录", icon: List },
  { id: "media", label: "媒体", icon: ImageIcon },
  { id: "search", label: "查找替换", icon: Search },
  { id: "history", label: "历史版本", icon: Clock3 },
];

export function DocumentFunctionRail({
  project,
  sheet,
  libraryPath,
  onToggleMode,
  railModeSwitchExpanded,
  onRailModeSwitchExpandedChange,
  onWindowDragStart,
  onWindowToolbarDoubleClick,
  onRailWheel,
  onRevealPosition,
  onReplaceBody,
  onRestoreVersion,
}: DocumentFunctionRailProps) {
  const [activeTab, setActiveTab] = useState<DocumentRailTab>("outline");
  const [searchMode, setSearchMode] = useState<SearchMode>("find");
  const [searchModeMenuOpen, setSearchModeMenuOpen] = useState(false);
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [activeSearchResultIndex, setActiveSearchResultIndex] = useState(0);
  const searchModeControlRef = useRef<HTMLDivElement | null>(null);
  const headings = useMemo(() => getSheetHeadings(sheet.body), [sheet.body]);
  const images = useMemo(() => buildImageItems(libraryPath, project, sheet), [libraryPath, project, sheet]);
  const versions = useMemo(
    () => [...(sheet.versions ?? [])].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
    [sheet.versions],
  );
  const searchResults = useMemo(() => buildSearchResults(sheet.body, findText), [sheet.body, findText]);
  const activeSearchResult = searchResults[Math.min(activeSearchResultIndex, Math.max(searchResults.length - 1, 0))] ?? null;
  const activeTabIndex = DOCUMENT_TABS.findIndex((tab) => tab.id === activeTab);

  useEffect(() => {
    setActiveSearchResultIndex(0);
  }, [findText, sheet.body, sheet.id]);

  useEffect(() => {
    if (!searchModeMenuOpen) return;

    function closeOnOutsidePointer(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Node && searchModeControlRef.current?.contains(target)) return;
      setSearchModeMenuOpen(false);
    }

    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") setSearchModeMenuOpen(false);
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer, true);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer, true);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [searchModeMenuOpen]);

  function selectSearchMode(mode: SearchMode) {
    setSearchMode(mode);
    setSearchModeMenuOpen(false);
  }

  function revealSearchResult(result: SearchResultItem, index: number) {
    setActiveSearchResultIndex(index);
    onRevealPosition(result.index);
  }

  function revealRelativeSearchResult(direction: -1 | 1) {
    if (searchResults.length === 0) return;
    const nextIndex = (activeSearchResultIndex + direction + searchResults.length) % searchResults.length;
    const result = searchResults[nextIndex];
    setActiveSearchResultIndex(nextIndex);
    onRevealPosition(result.index);
  }

  function replaceOne() {
    if (!findText || !activeSearchResult) return;
    const nextBody = `${sheet.body.slice(0, activeSearchResult.index)}${replaceText}${sheet.body.slice(activeSearchResult.index + findText.length)}`;
    onReplaceBody(nextBody);
    onRevealPosition(activeSearchResult.index + replaceText.length);
  }

  function replaceAll() {
    if (!findText || searchResults.length === 0) return;
    onReplaceBody(sheet.body.split(findText).join(replaceText));
  }

  return (
    <aside className="sheet-rail document-function-rail" onWheel={onRailWheel}>
      <div className="sheet-rail-content document-function-content">
        <div
          className="rail-toolbar document-local-toolbar"
          data-tauri-drag-region
          onMouseDown={onWindowDragStart}
          onDoubleClick={onWindowToolbarDoubleClick}
        />

        <header className="document-function-header">
          <div className="document-function-meta">
            <strong title={sheet.title}>{sheet.title || "无标题"}</strong>
            <small>{sheet.updatedAt ? `${formatSnapshotTime(sheet.updatedAt)} 更新` : "当前文稿"}</small>
          </div>
        </header>

        <div className="document-function-tabs" role="tablist" aria-label="文稿功能" data-active-index={activeTabIndex}>
          <span className="document-function-tab-indicator" aria-hidden="true" />
          {DOCUMENT_TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                className={clsx(activeTab === tab.id && "active")}
                title={tab.label}
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={16} />
              </button>
            );
          })}
        </div>

        <div className="document-function-body">
          {activeTab === "outline" && (
            <section className="document-function-section">
              <h2>目录</h2>
              <div className="document-outline-list">
                {headings.map((heading) => (
                  <button
                    key={heading.id}
                    type="button"
                    className={`heading-level-${heading.level}`}
                    onClick={() => onRevealPosition(positionFromLine(sheet.body, heading.line))}
                  >
                    <span>{heading.text}</span>
                    <small>L{heading.line}</small>
                  </button>
                ))}
                {headings.length === 0 && <p className="document-function-empty">当前文稿还没有 Markdown 标题。</p>}
              </div>
            </section>
          )}

          {activeTab === "media" && (
            <section className="document-function-section">
              <h2>媒体</h2>
              <div className="document-media-grid">
                {images.map((image) => (
                  <button key={`${image.index}-${image.path}`} type="button" onClick={() => onRevealPosition(image.index)}>
                    {image.src ? <img src={image.src} alt={image.alt || image.label} /> : <span>{image.label}</span>}
                  </button>
                ))}
                {images.length === 0 && <p className="document-function-empty">当前文稿还没有插入图片。</p>}
              </div>
            </section>
          )}

          {activeTab === "search" && (
            <section className="document-function-section document-search-section">
              <div className="document-function-section-title">
                <div className="document-search-mode-control" ref={searchModeControlRef}>
                  <button
                    type="button"
                    onClick={() => setSearchModeMenuOpen((open) => !open)}
                    aria-haspopup="menu"
                    aria-expanded={searchModeMenuOpen}
                  >
                    {searchMode === "find" ? "查找" : "查找和替换"}
                    <ChevronDown size={14} />
                  </button>
                  {searchModeMenuOpen && (
                    <div className="document-search-mode-menu" role="menu">
                      <button type="button" className={clsx(searchMode === "find" && "selected")} onClick={() => selectSearchMode("find")}>
                        查找
                      </button>
                      <button
                        type="button"
                        className={clsx(searchMode === "replace" && "selected")}
                        onClick={() => selectSearchMode("replace")}
                      >
                        查找和替换
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <label className="document-search-field">
                <Search size={16} />
                <input value={findText} placeholder="文档中的文本" onChange={(event) => setFindText(event.target.value)} />
                {findText && (
                  <button type="button" className="document-search-clear" onClick={() => setFindText("")} aria-label="清除搜索">
                    <CircleX size={16} />
                  </button>
                )}
              </label>
              {searchMode === "replace" && (
                <>
                  <label className="document-search-field">
                    <ArrowRight size={16} />
                    <input value={replaceText} placeholder="替换为" onChange={(event) => setReplaceText(event.target.value)} />
                  </label>
                  <div className="document-replace-actions">
                    <button type="button" disabled={!findText || searchResults.length === 0} onClick={replaceOne}>
                      替换
                    </button>
                    <button type="button" disabled={!findText || searchResults.length === 0} onClick={replaceAll}>
                      全部替换
                    </button>
                  </div>
                </>
              )}
              <div className="document-search-summary">
                <span>{findText ? `${searchResults.length} 个结果` : "输入关键词开始查找"}</span>
                <div className="document-search-stepper">
                  <button
                    type="button"
                    disabled={searchResults.length === 0}
                    onClick={() => revealRelativeSearchResult(-1)}
                    aria-label="上一个结果"
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    type="button"
                    disabled={searchResults.length === 0}
                    onClick={() => revealRelativeSearchResult(1)}
                    aria-label="下一个结果"
                  >
                    <ArrowDown size={16} />
                  </button>
                </div>
              </div>
              <div className="document-search-results">
                {searchResults.map((result, index) => (
                  <button
                    key={result.id}
                    type="button"
                    className={clsx(index === activeSearchResultIndex && "active")}
                    onClick={() => revealSearchResult(result, index)}
                  >
                    <small>L{result.line}</small>
                    <span>
                      {result.before}
                      <strong>{result.match}</strong>
                      {result.after}
                    </span>
                  </button>
                ))}
                {findText && searchResults.length === 0 && <p className="document-function-empty">没有找到匹配内容。</p>}
              </div>
            </section>
          )}

          {activeTab === "history" && (
            <section className="document-function-section">
              <h2>历史版本</h2>
              <div className="document-version-list">
                {versions.map((version) => (
                  <article key={version.id} className="document-version-row">
                    <div>
                      <strong>{version.title}</strong>
                      <small>
                        {formatSnapshotTime(version.createdAt)} · {version.wordCount} 字
                      </small>
                      {version.reason && <small>{version.reason}</small>}
                    </div>
                    <button type="button" onClick={() => onRestoreVersion(version)}>
                      恢复
                    </button>
                  </article>
                ))}
                {versions.length === 0 && <p className="document-function-empty">还没有历史版本。</p>}
              </div>
            </section>
          )}
        </div>

        <RailModeSwitch
          active="document"
          expanded={railModeSwitchExpanded}
          onExpandedChange={onRailModeSwitchExpandedChange}
          onSelectMode={(mode) => {
            if (mode === "list") onToggleMode();
          }}
        />
      </div>
    </aside>
  );
}

export function RailModeSwitch({
  active,
  expanded,
  onExpandedChange,
  onSelectMode,
}: {
  active: "list" | "document";
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onSelectMode: (mode: "list" | "document") => void;
}) {
  return (
    <div
      className={clsx("rail-mode-switch", expanded && "is-expanded")}
      role="group"
      aria-label="列表栏切换"
      onPointerEnter={() => onExpandedChange(true)}
      onPointerLeave={() => onExpandedChange(false)}
    >
      <button
        type="button"
        className={clsx("rail-mode-option", active === "list" && "active")}
        title="列表"
        aria-label="列表"
        aria-pressed={active === "list"}
        onClick={() => onSelectMode("list")}
      >
        <span className="rail-mode-dot" />
        <Folder className="rail-mode-icon" size={18} strokeWidth={2.1} />
      </button>
      <button
        type="button"
        className={clsx("rail-mode-option", active === "document" && "active")}
        title="文稿"
        aria-label="文稿"
        aria-pressed={active === "document"}
        onClick={() => onSelectMode("document")}
      >
        <span className="rail-mode-dot" />
        <FileText className="rail-mode-icon" size={18} strokeWidth={2.1} />
      </button>
    </div>
  );
}

function buildImageItems(libraryPath: string, project: WritingProject, sheet: WritingSheet) {
  return parseImageReferences(sheet.body).map((reference) => {
    const sourcePath = libraryPath.startsWith("/") ? resolveSheetImageSourcePath(libraryPath, project, sheet, reference.path) : "";
    return {
      ...reference,
      label: reference.alt || stripExtension(getBasename(reference.path)) || "图片",
      src: sourcePath ? convertFileSrc(sourcePath) : externalImageUrl(reference.path),
    };
  });
}

function externalImageUrl(path: string) {
  return /^https?:\/\//i.test(path) ? path : "";
}

function buildSearchResults(body: string, query: string): SearchResultItem[] {
  if (!query) return [];
  const results: SearchResultItem[] = [];
  const lines = body.split("\n");
  let offset = 0;

  lines.forEach((line, lineIndex) => {
    let searchFrom = 0;
    while (searchFrom <= line.length) {
      const matchIndex = line.indexOf(query, searchFrom);
      if (matchIndex === -1) break;
      const absoluteIndex = offset + matchIndex;
      const beforeStart = Math.max(0, matchIndex - 18);
      const afterEnd = Math.min(line.length, matchIndex + query.length + 32);
      results.push({
        id: `${absoluteIndex}-${lineIndex}`,
        index: absoluteIndex,
        line: lineIndex + 1,
        before: `${beforeStart > 0 ? "..." : ""}${line.slice(beforeStart, matchIndex)}`,
        match: line.slice(matchIndex, matchIndex + query.length),
        after: `${line.slice(matchIndex + query.length, afterEnd)}${afterEnd < line.length ? "..." : ""}`,
      });
      searchFrom = matchIndex + Math.max(query.length, 1);
    }
    offset += line.length + 1;
  });

  return results;
}

function positionFromLine(body: string, lineNumber: number) {
  if (lineNumber <= 1) return 0;
  const lines = body.split("\n");
  let position = 0;
  for (let index = 0; index < Math.min(lineNumber - 1, lines.length); index += 1) {
    position += lines[index].length + 1;
  }
  return Math.min(position, body.length);
}
