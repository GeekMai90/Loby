import type { RefObject } from "react";
import { ArrowDown, ArrowRight, ArrowUp, ChevronDown, CircleX, Search } from "lucide-react";
import clsx from "clsx";
import type { SearchResultItem } from "../lib/documentFunctionRail";

export type DocumentSearchMode = "find" | "replace";

interface DocumentSearchSectionProps {
  searchMode: DocumentSearchMode;
  searchModeMenuOpen: boolean;
  searchModeControlRef: RefObject<HTMLDivElement | null>;
  findText: string;
  replaceText: string;
  searchResults: SearchResultItem[];
  activeSearchResultIndex: number;
  onToggleSearchModeMenu: () => void;
  onSelectSearchMode: (mode: DocumentSearchMode) => void;
  onFindTextChange: (value: string) => void;
  onReplaceTextChange: (value: string) => void;
  onReplaceOne: () => void;
  onReplaceAll: () => void;
  onRevealRelativeSearchResult: (direction: -1 | 1) => void;
  onRevealSearchResult: (result: SearchResultItem, index: number) => void;
}

export function DocumentSearchSection({
  searchMode,
  searchModeMenuOpen,
  searchModeControlRef,
  findText,
  replaceText,
  searchResults,
  activeSearchResultIndex,
  onToggleSearchModeMenu,
  onSelectSearchMode,
  onFindTextChange,
  onReplaceTextChange,
  onReplaceOne,
  onReplaceAll,
  onRevealRelativeSearchResult,
  onRevealSearchResult,
}: DocumentSearchSectionProps) {
  return (
    <section className="document-function-section document-search-section">
      <div className="document-function-section-title">
        <div className="document-search-mode-control" ref={searchModeControlRef}>
          <button type="button" onClick={onToggleSearchModeMenu} aria-haspopup="menu" aria-expanded={searchModeMenuOpen}>
            {searchMode === "find" ? "查找" : "查找和替换"}
            <ChevronDown size={14} />
          </button>
          {searchModeMenuOpen && (
            <div className="document-search-mode-menu" role="menu">
              <button type="button" className={clsx(searchMode === "find" && "selected")} onClick={() => onSelectSearchMode("find")}>
                查找
              </button>
              <button type="button" className={clsx(searchMode === "replace" && "selected")} onClick={() => onSelectSearchMode("replace")}>
                查找和替换
              </button>
            </div>
          )}
        </div>
      </div>
      <label className="document-search-field">
        <Search size={16} />
        <input value={findText} placeholder="文档中的文本" onChange={(event) => onFindTextChange(event.target.value)} />
        {findText && (
          <button type="button" className="document-search-clear" onClick={() => onFindTextChange("")} aria-label="清除搜索">
            <CircleX size={16} />
          </button>
        )}
      </label>
      {searchMode === "replace" && (
        <>
          <label className="document-search-field">
            <ArrowRight size={16} />
            <input value={replaceText} placeholder="替换为" onChange={(event) => onReplaceTextChange(event.target.value)} />
          </label>
          <div className="document-replace-actions">
            <button type="button" disabled={!findText || searchResults.length === 0} onClick={onReplaceOne}>
              替换
            </button>
            <button type="button" disabled={!findText || searchResults.length === 0} onClick={onReplaceAll}>
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
            onClick={() => onRevealRelativeSearchResult(-1)}
            aria-label="上一个结果"
          >
            <ArrowUp size={16} />
          </button>
          <button
            type="button"
            disabled={searchResults.length === 0}
            onClick={() => onRevealRelativeSearchResult(1)}
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
            onClick={() => onRevealSearchResult(result, index)}
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
  );
}
