import { FileText, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { WritingProject, WritingSheet } from "../types";

interface WechatThemeArticleRailProps {
  projects: WritingProject[];
  activeSheetId: string;
  search: string;
  onSearchChange: (value: string) => void;
  onSelect: (project: WritingProject, sheet: WritingSheet) => void;
}

export function WechatThemeArticleRail({ projects, activeSheetId, search, onSearchChange, onSelect }: WechatThemeArticleRailProps) {
  const needle = search.trim().toLowerCase();
  const sections = projects
    .map((project) => ({
      project,
      sheets: project.sheets.filter(
        (sheet) => !sheet.archivedAt && (!needle || `${sheet.title} ${project.title} ${sheet.summary}`.toLowerCase().includes(needle)),
      ),
    }))
    .filter((section) => section.sheets.length > 0);

  return (
    <aside className="flex min-h-0 min-w-0 flex-col border-r border-border bg-muted/25">
      <div className="border-b border-border px-3 py-3">
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
        {sections.map(({ project, sheets }) => (
          <section key={project.id} className="mb-4">
            <h2 className="px-2 pb-1.5 text-[11px] font-medium tracking-wide text-muted-foreground">{project.title}</h2>
            <div className="space-y-0.5">
              {sheets.map((sheet) => {
                const active = sheet.id === activeSheetId;
                return (
                  <button
                    key={sheet.id}
                    type="button"
                    className={`flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left transition-colors ${
                      active ? "bg-[#DFF1FC] text-[#0066CC]" : "text-foreground hover:bg-muted"
                    }`}
                    onClick={() => onSelect(project, sheet)}
                  >
                    <FileText className="mt-0.5 size-3.5 shrink-0 opacity-70" />
                    <span className="min-w-0">
                      <strong className="block truncate text-xs font-medium">{sheet.title || "未命名文稿"}</strong>
                      {sheet.summary && <small className="mt-0.5 block truncate text-[10px] text-muted-foreground">{sheet.summary}</small>}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
        {sections.length === 0 && <p className="px-3 py-8 text-center text-xs text-muted-foreground">没有匹配的文章</p>}
      </div>
    </aside>
  );
}
