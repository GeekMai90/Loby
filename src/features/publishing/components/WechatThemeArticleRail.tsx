/**
 * [INPUT]: 依赖 React 运行时、lucide-react、shadcn/ui 基础控件、共享 NavigationItem、发布模块与公共契约
 * [OUTPUT]: 对外提供只显示文章标题并复用统一导航几何的 WechatThemeArticleRail
 * [POS]: 发布 feature 的界面组合单元，连接 发布 状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useState } from "react";
import { FileText, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WECHAT_THEME_SAMPLE_PROJECT_ID } from "@/features/publishing/model/wechatThemeSampleArticle";
import type { WritingProject, WritingSheet } from "@/shared/types";
import { NavigationItem } from "@/shared/components/NavigationItem";

const DEFAULT_ARTICLE_LIMIT = 30;

interface ArticleEntry {
  project: WritingProject;
  sheet: WritingSheet;
}

interface WechatThemeArticleRailProps {
  projects: WritingProject[];
  activeSheetId: string;
  search: string;
  onSearchChange: (value: string) => void;
  onSelect: (project: WritingProject, sheet: WritingSheet) => void;
}

export function WechatThemeArticleRail({ projects, activeSheetId, search, onSearchChange, onSelect }: WechatThemeArticleRailProps) {
  const [visibleArticleCount, setVisibleArticleCount] = useState(DEFAULT_ARTICLE_LIMIT);
  const needle = search.trim().toLowerCase();
  const entries = projects.flatMap((project) => project.sheets.filter((sheet) => !sheet.archivedAt).map((sheet) => ({ project, sheet })));
  const matchesSearch = ({ project, sheet }: ArticleEntry) =>
    !needle || `${sheet.title} ${project.title} ${sheet.summary ?? ""}`.toLowerCase().includes(needle);
  const sampleEntries = entries.filter(({ project }) => project.id === WECHAT_THEME_SAMPLE_PROJECT_ID).filter(matchesSearch);
  const allArticleEntries = entries
    .filter(({ project }) => project.id !== WECHAT_THEME_SAMPLE_PROJECT_ID)
    .filter(matchesSearch)
    .sort((left, right) => Date.parse(right.sheet.updatedAt) - Date.parse(left.sheet.updatedAt));
  const visibleArticleEntries = needle ? allArticleEntries : allArticleEntries.slice(0, visibleArticleCount);
  const hasMoreArticles = !needle && visibleArticleEntries.length < allArticleEntries.length;
  const hasSearchMatches = sampleEntries.length > 0 || allArticleEntries.length > 0;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="px-3 pt-3 pb-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="搜索文章"
            className="h-8 bg-background pr-2 pl-8 text-xs"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {(!needle || sampleEntries.length > 0) && (
          <ArticleSection title="示例文章" entries={sampleEntries} activeSheetId={activeSheetId} onSelect={onSelect} />
        )}
        {(!needle || allArticleEntries.length > 0) && (
          <ArticleSection
            title="所有文章"
            entries={visibleArticleEntries}
            activeSheetId={activeSheetId}
            emptyMessage="还没有可用的文章"
            onSelect={onSelect}
          />
        )}
        {hasMoreArticles && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mb-2 w-full text-xs text-muted-foreground"
            onClick={() => setVisibleArticleCount((count) => count + DEFAULT_ARTICLE_LIMIT)}
          >
            显示更多
          </Button>
        )}
        {needle && !hasSearchMatches && <p className="px-3 py-8 text-center text-xs text-muted-foreground">没有匹配的文章</p>}
      </div>
    </div>
  );
}

interface ArticleSectionProps {
  title: string;
  entries: ArticleEntry[];
  activeSheetId: string;
  emptyMessage?: string;
  onSelect: (project: WritingProject, sheet: WritingSheet) => void;
}

function ArticleSection({ title, entries, activeSheetId, emptyMessage, onSelect }: ArticleSectionProps) {
  return (
    <section className="mb-4">
      <h2 className="px-2 pb-1.5 text-[11px] font-medium tracking-wide text-muted-foreground">{title}</h2>
      <div className="flex flex-col gap-1">
        {entries.map(({ project, sheet }) => {
          const active = sheet.id === activeSheetId;
          return (
            <NavigationItem key={`${project.id}:${sheet.id}`} selected={active} active onClick={() => onSelect(project, sheet)}>
              <FileText />
              <span className="min-w-0 truncate">{sheet.title || "未命名文稿"}</span>
            </NavigationItem>
          );
        })}
        {entries.length === 0 && emptyMessage && <p className="px-2 py-4 text-center text-xs text-muted-foreground">{emptyMessage}</p>}
      </div>
    </section>
  );
}
