/**
 * [INPUT]: 依赖 lucide-react、shadcn/ui 基础控件、index.css 空状态语义 Token 与写作库模块
 * [OUTPUT]: 对外提供 EmptyLibraryState
 * [POS]: 写作库 feature 的异常空状态恢复单元，只提供通用项目创建、导入与文件夹入口
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Download, FolderOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isDesktopLibraryPath } from "@/features/library/model/libraryRegistry";

interface EmptyLibraryStateProps {
  libraryPath: string;
  onCreateProject: () => void;
  onImportMarkdown: () => void;
  onOpenLibrary: () => void;
}

export function EmptyLibraryState({ libraryPath, onCreateProject, onImportMarkdown, onOpenLibrary }: EmptyLibraryStateProps) {
  return (
    <main className="grid h-screen place-content-center bg-background text-center">
      <section className="grid w-[min(640px,calc(100vw-48px))] justify-items-center gap-3.5 rounded-lg border border-border bg-card p-8.5">
        <div className="grid size-9.5 place-items-center rounded-lg border border-[var(--empty-library-mark-border)] [background:var(--empty-library-mark-bg)] font-extrabold text-primary shadow-[var(--empty-library-mark-shadow)]">
          N
        </div>
        <h1 className="m-0">落笔</h1>
        <p className="m-0">还没有写作项目。</p>
        <small className="max-w-full truncate text-xs text-muted-foreground">{libraryPath}</small>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={onCreateProject}>
            <Plus /> 创建项目
          </Button>
          <Button variant="outline" onClick={onImportMarkdown}>
            <Download /> 导入 Markdown
          </Button>
          <Button variant="outline" onClick={onOpenLibrary} disabled={!isDesktopLibraryPath(libraryPath)}>
            <FolderOpen /> 打开写作文件夹
          </Button>
        </div>
      </section>
    </main>
  );
}
