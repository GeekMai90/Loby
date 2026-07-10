import { useEffect, useMemo, useRef, useState, type MouseEvent, type WheelEvent } from "react";
import { formatSnapshotTime } from "../lib/formatters";
import { buildDocumentImageItems, buildSearchResults, type SearchResultItem } from "../lib/documentFunctionRail";
import { getSheetHeadings } from "../lib/markdownOutline";
import type { SheetVersion, WritingProject, WritingSheet } from "../types";
import { DocumentFunctionTabs, type DocumentRailTab } from "./DocumentFunctionTabs";
import { DocumentHistorySection, DocumentMediaSection, DocumentOutlineSection } from "./DocumentFunctionSections";
import { DocumentSearchSection, type DocumentSearchMode } from "./DocumentSearchSection";
import { RailModeSwitch } from "./RailModeSwitch";

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
  const [searchMode, setSearchMode] = useState<DocumentSearchMode>("find");
  const [searchModeMenuOpen, setSearchModeMenuOpen] = useState(false);
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [activeSearchResultIndex, setActiveSearchResultIndex] = useState(0);
  const searchModeControlRef = useRef<HTMLDivElement | null>(null);
  const headings = useMemo(() => getSheetHeadings(sheet.body), [sheet.body]);
  const images = useMemo(() => buildDocumentImageItems(libraryPath, project, sheet), [libraryPath, project, sheet]);
  const versions = useMemo(
    () => [...(sheet.versions ?? [])].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
    [sheet.versions],
  );
  const searchResults = useMemo(() => buildSearchResults(sheet.body, findText), [sheet.body, findText]);
  const activeSearchResult = searchResults[Math.min(activeSearchResultIndex, Math.max(searchResults.length - 1, 0))] ?? null;

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

  function selectSearchMode(mode: DocumentSearchMode) {
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

        <DocumentFunctionTabs activeTab={activeTab} onActiveTabChange={setActiveTab} />

        <div className="document-function-body">
          {activeTab === "outline" && <DocumentOutlineSection body={sheet.body} headings={headings} onRevealPosition={onRevealPosition} />}

          {activeTab === "media" && <DocumentMediaSection images={images} onRevealPosition={onRevealPosition} />}

          {activeTab === "search" && (
            <DocumentSearchSection
              searchMode={searchMode}
              searchModeMenuOpen={searchModeMenuOpen}
              searchModeControlRef={searchModeControlRef}
              findText={findText}
              replaceText={replaceText}
              searchResults={searchResults}
              activeSearchResultIndex={activeSearchResultIndex}
              onToggleSearchModeMenu={() => setSearchModeMenuOpen((open) => !open)}
              onSelectSearchMode={selectSearchMode}
              onFindTextChange={setFindText}
              onReplaceTextChange={setReplaceText}
              onReplaceOne={replaceOne}
              onReplaceAll={replaceAll}
              onRevealRelativeSearchResult={revealRelativeSearchResult}
              onRevealSearchResult={revealSearchResult}
            />
          )}

          {activeTab === "history" && <DocumentHistorySection versions={versions} onRestoreVersion={onRestoreVersion} />}
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
