/**
 * [INPUT]: 依赖 React、lucide-react 与 shadcn Button
 * [OUTPUT]: 对外提供 DeveloperGalleryShell，为开发态设计系统与颜色系统提供统一标题栏、关闭入口和滚动矩阵
 * [POS]: design-gallery 的页面外壳，只约束开发工具页结构，不持有任何审计或组件样例数据
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { X, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface DeveloperGalleryShellProps {
  icon: LucideIcon;
  title: string;
  summary: string;
  closeLabel: string;
  contentLabel: string;
  onClose: () => void;
  children: ReactNode;
}

export function DeveloperGalleryShell({
  icon: Icon,
  title,
  summary,
  closeLabel,
  contentLabel,
  onClose,
  children,
}: DeveloperGalleryShellProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background text-foreground" data-app-tooltip-scope>
      <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-border px-4" data-tauri-drag-region>
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="size-4 text-primary" aria-hidden="true" />
          <span className="text-body truncate font-semibold">{title}</span>
          <span className="text-caption text-muted-foreground">{summary}</span>
          <span className="text-caption rounded-full bg-primary/10 px-2 py-0.5 font-bold tracking-[0.08em] text-primary uppercase">
            Dev only
          </span>
        </div>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={closeLabel} title="返回文稿" onClick={onClose}>
          <X />
        </Button>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto bg-background" aria-label={contentLabel}>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] items-stretch gap-px bg-[var(--separator)]">
          {children}
        </div>
      </main>
    </div>
  );
}
