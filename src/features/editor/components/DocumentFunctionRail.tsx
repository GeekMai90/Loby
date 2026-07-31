/**
 * [INPUT]: 依赖 React 运行时、shared 公共契约、编辑器模块
 * [OUTPUT]: 对外提供 DocumentFunctionRail，以执行时正文变换提交查找替换
 * [POS]: 编辑器 feature 的界面组合单元，搜索列表消费模型快照，替换只描述意图并由 app 应用于 CodeMirror 最新正文
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useEffect, useMemo, useState, type MouseEvent, type WheelEvent } from "react";
import { formatSnapshotTime } from "@/shared/lib/formatters";
import {
  buildDocumentImageItems,
  buildSearchResults,
  replaceAllDocumentSearchMatches,
  replaceDocumentSearchMatch,
  type SearchResultItem,
} from "@/features/editor/model/documentFunctionRail";
import type { SheetVersion, WritingProject, WritingSheet } from "@/shared/types";
import { DocumentFunctionTabs, type DocumentRailTab } from "@/features/editor/components/DocumentFunctionTabs";
import { DocumentHistorySection, DocumentMediaSection } from "@/features/editor/components/DocumentFunctionSections";
import { DocumentSearchSection, type DocumentSearchMode } from "@/features/editor/components/DocumentSearchSection";
import { RailModeSwitch } from "@/shared/components/RailModeSwitch";

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
  onReplaceBody: (replace: (body: string) => string) => void;
  previewedVersionId: string;
  onPreviewVersion: (version: SheetVersion) => void;
  onCloseVersionPreview: () => void;
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
  previewedVersionId,
  onPreviewVersion,
  onCloseVersionPreview,
  onRestoreVersion,
}: DocumentFunctionRailProps) {
  const [activeTab, setActiveTab] = useState<DocumentRailTab>("media");
  const [searchMode, setSearchMode] = useState<DocumentSearchMode>("find");
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [activeSearchResultIndex, setActiveSearchResultIndex] = useState(0);
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
    onReplaceBody((body) => replaceDocumentSearchMatch(body, findText, replaceText, activeSearchResult.index));
    onRevealPosition(activeSearchResult.index + replaceText.length);
  }

  function replaceAll() {
    if (!findText || searchResults.length === 0) return;
    onReplaceBody((body) => replaceAllDocumentSearchMatches(body, findText, replaceText));
  }

  function selectTab(tab: DocumentRailTab) {
    setActiveTab(tab);
    if (tab !== "history") onCloseVersionPreview();
  }

  return (
    <aside className="sheet-rail relative col-start-2 min-h-0" onWheel={onRailWheel}>
      <div className="sheet-rail-content relative">
        <div
          className="rail-toolbar sheet-local-toolbar"
          data-tauri-drag-region
          onMouseDown={onWindowDragStart}
          onDoubleClick={onWindowToolbarDoubleClick}
        />

        <header className="flex shrink-0 items-start border-b border-[var(--sidebar-stroke)] px-1 pt-0.75 pb-3.5">
          <div className="min-w-0">
            <strong className="block truncate text-[17px] leading-tight font-bold" title={sheet.title}>
              {sheet.title || "无标题"}
            </strong>
            <small className="mt-1 block truncate text-xs font-medium text-muted-foreground">
              {sheet.updatedAt ? `${formatSnapshotTime(sheet.updatedAt)} 更新` : "当前文稿"}
            </small>
          </div>
        </header>

        <DocumentFunctionTabs activeTab={activeTab} onActiveTabChange={selectTab} />

        <div className="-mr-2 min-h-0 flex-1 overflow-auto pr-2.5 pb-4.5 pl-0.5 [scroll-padding-bottom:72px]">
          {activeTab === "media" && <DocumentMediaSection images={images} onRevealPosition={onRevealPosition} />}

          {activeTab === "search" && (
            <DocumentSearchSection
              searchMode={searchMode}
              findText={findText}
              replaceText={replaceText}
              searchResults={searchResults}
              activeSearchResultIndex={activeSearchResultIndex}
              onSelectSearchMode={setSearchMode}
              onFindTextChange={setFindText}
              onReplaceTextChange={setReplaceText}
              onReplaceOne={replaceOne}
              onReplaceAll={replaceAll}
              onRevealRelativeSearchResult={revealRelativeSearchResult}
              onRevealSearchResult={revealSearchResult}
            />
          )}

          {activeTab === "history" && (
            <DocumentHistorySection
              versions={versions}
              previewedVersionId={previewedVersionId}
              onPreviewVersion={onPreviewVersion}
              onRestoreVersion={onRestoreVersion}
            />
          )}
        </div>

        <RailModeSwitch
          active="document"
          expanded={railModeSwitchExpanded}
          onExpandedChange={onRailModeSwitchExpandedChange}
          onSelectMode={(mode) => {
            if (mode === "list") {
              onCloseVersionPreview();
              onToggleMode();
            }
          }}
        />
      </div>
    </aside>
  );
}
