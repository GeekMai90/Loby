/**
 * [INPUT]: 依赖 Dialog/Input UI、native Tantivy 搜索 command、当前写作库项目模型与 React 运行时
 * [OUTPUT]: 对外提供全局 Markdown 全文搜索模态窗，返回普通打开或进入项目定位两种明确动作，并清理摘要中的图片引用、突出正文命中词
 * [POS]: 写作库 feature 的搜索交互边界，只负责查询、结果键盘导航与结果展示，不拥有工作区选择状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { FileText, LoaderCircle, Search } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { parseImageReferences } from "@/features/library/model/imageAssets";
import { searchLibrary, type SearchHit } from "@/features/library/model/persistence";
import { getVisibleProjectGroups, isInboxProject, isNotesProject } from "@/features/library/model/projectModel";
import { SearchHighlight } from "@/features/library/components/SearchHighlight";
import type { WritingProject, WritingSheet } from "@/shared/types";

interface GlobalSearchDialogProps {
  open: boolean;
  libraryPath: string;
  projects: WritingProject[];
  onClose: () => void;
  onOpenSheet: (sheetId: string, mode: "all" | "project") => void;
}

interface SearchResultView {
  hit: SearchHit;
  sheet: WritingSheet;
  project: WritingProject;
  location: string;
}

export function GlobalSearchDialog({ open, libraryPath, projects, onClose, onOpenSheet }: GlobalSearchDialogProps) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  const resultViews = useMemo(() => {
    const sheets = new Map<string, { sheet: WritingSheet; project: WritingProject }>();
    for (const project of projects) {
      for (const sheet of project.sheets) sheets.set(sheet.id, { sheet, project });
    }
    return hits.flatMap((hit): SearchResultView[] => {
      const owner = sheets.get(hit.sheetId);
      if (!owner || owner.project.archivedAt || owner.sheet.archivedAt) return [];
      const location = resolveSheetLocation(owner.project, owner.sheet);
      return [{ hit, ...owner, location }];
    });
  }, [hits, projects]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setHits([]);
    setSelectedIndex(0);
    setSearchError("");
  }, [open]);

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (!open || !normalizedQuery) {
      setHits([]);
      setSearching(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSearching(true);
      setSearchError("");
      void searchLibrary(libraryPath, normalizedQuery, 50)
        .then((nextHits) => {
          if (cancelled) return;
          setHits(nextHits);
          setSelectedIndex(0);
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          setHits([]);
          setSearchError(error instanceof Error ? error.message : "搜索暂时不可用");
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 60);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [libraryPath, open, query]);

  function openSelected(mode: "all" | "project") {
    const selected = resultViews[selectedIndex];
    if (!selected) return;
    onOpenSheet(selected.sheet.id, mode);
  }

  function moveSelection(offset: number) {
    if (resultViews.length === 0) return;
    setSelectedIndex((current) => (current + offset + resultViews.length) % resultViews.length);
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="grid h-[min(680px,calc(100vh-48px))] max-h-[calc(100vh-48px)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-[720px]"
      >
        <DialogTitle className="sr-only">搜索文稿</DialogTitle>
        <DialogDescription className="sr-only">搜索当前写作库中的 Markdown 标题和正文。</DialogDescription>

        <div className="border-b border-border px-5 py-4">
          <div className="relative">
            <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-primary" />
            <Input
              autoFocus
              aria-label="搜索文稿标题和正文"
              className="h-11 rounded-xl border-primary/35 bg-background/80 pr-3 pl-10 text-[15px] shadow-sm focus-visible:border-primary/65 focus-visible:ring-3 focus-visible:ring-primary/10"
              placeholder="搜索文章标题或正文…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  moveSelection(1);
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  moveSelection(-1);
                } else if (event.key === "Enter") {
                  event.preventDefault();
                  openSelected(event.metaKey || event.ctrlKey ? "project" : "all");
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  onClose();
                }
              }}
            />
          </div>
        </div>

        <div aria-label="搜索结果" className="min-h-0 overflow-y-auto px-3 py-3" role="listbox" tabIndex={-1}>
          {!query.trim() && <SearchEmptyState icon={<Search aria-hidden="true" />} text="输入关键词搜索文章标题和正文" />}
          {query.trim() && searching && (
            <SearchEmptyState icon={<LoaderCircle aria-hidden="true" className="animate-spin" />} text="正在搜索…" />
          )}
          {query.trim() && !searching && searchError && <SearchEmptyState icon={<FileText aria-hidden="true" />} text={searchError} />}
          {query.trim() && !searching && !searchError && resultViews.length === 0 && (
            <SearchEmptyState icon={<FileText aria-hidden="true" />} text="没有找到匹配的文章" />
          )}
          {resultViews.map((result, index) => {
            const selected = index === selectedIndex;
            return (
              <button
                key={result.sheet.id}
                id={`global-search-result-${result.sheet.id}`}
                type="button"
                role="option"
                aria-selected={selected}
                className={`mb-1 flex w-full cursor-pointer flex-col gap-1 rounded-xl border border-transparent px-3 py-3 text-left outline-none transition-colors last:mb-0 ${
                  selected ? "border-primary/20 bg-primary/8" : "hover:bg-foreground/5"
                }`}
                onMouseEnter={() => setSelectedIndex(index)}
                onClick={(event) => onOpenSheet(result.sheet.id, event.metaKey || event.ctrlKey ? "project" : "all")}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <FileText aria-hidden="true" className="size-4 shrink-0 text-primary/75" />
                  <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">
                    <SearchHighlight text={result.hit.title} query={query} />
                  </span>
                </span>
                <span className="truncate pl-6 text-xs text-muted-foreground">{result.location}</span>
                <span className="line-clamp-2 pl-6 text-[13px] leading-5 text-foreground/65">
                  <SearchHighlight text={buildSnippet(result.sheet.body, query)} query={query} />
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-5 py-3 text-[11px] text-muted-foreground">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> 选择
          </span>
          <span>
            <kbd>Enter</kbd> 打开
          </span>
          <span>
            <kbd>⌘ Enter</kbd> 进入项目定位
          </span>
          <span>
            <kbd>Esc</kbd> 关闭
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SearchEmptyState({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex h-full min-h-56 flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
      <span className="grid size-10 place-items-center rounded-full bg-foreground/5 text-foreground/35">{icon}</span>
      <span>{text}</span>
    </div>
  );
}

function resolveSheetLocation(project: WritingProject, sheet: WritingSheet): string {
  if (isInboxProject(project)) return "收件箱";
  if (isNotesProject(project)) {
    const group = getVisibleProjectGroups(project).find((item) => item.id === sheet.groupId);
    return group ? `笔记 · ${group.title}` : "笔记";
  }
  const group = getVisibleProjectGroups(project).find((item) => item.id === sheet.groupId);
  return group ? `${project.title} · ${group.title}` : project.title;
}

function buildSnippet(body: string, query: string): string {
  const visibleBody = cleanSearchBody(body);
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const lowerBody = visibleBody.toLocaleLowerCase();
  const matchIndex =
    terms
      .map((term) => lowerBody.indexOf(term))
      .filter((index) => index >= 0)
      .sort((a, b) => a - b)[0] ?? 0;
  const start = Math.max(0, matchIndex - 52);
  const end = Math.min(visibleBody.length, matchIndex + Math.max(90, terms[0]?.length ?? 0));
  const snippet = visibleBody.slice(start, end).trim();
  if (!snippet) return "无正文摘要";
  return `${start > 0 ? "…" : ""}${snippet}${end < visibleBody.length ? "…" : ""}`;
}

function cleanSearchBody(body: string): string {
  const references = parseImageReferences(body);
  let cursor = 0;
  let visible = "";
  for (const reference of references) {
    visible += body.slice(cursor, reference.index);
    cursor = reference.index + reference.raw.length;
  }
  visible += body.slice(cursor);

  return visible
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^\s*[-*+]\s+(?:\[[ xX]\]\s+)?/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}
