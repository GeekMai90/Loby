/**
 * [INPUT]: 依赖 lucide-react、shadcn/ui 基础控件、index.css 空状态语义 Token 与写作库模块
 * [OUTPUT]: 对外提供 EmptyLibraryState
 * [POS]: 写作库 feature 的界面组合单元，连接 写作库 状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Download, FilePlus2, FolderOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PROJECT_TEMPLATES } from "@/features/library/constants/projectTemplates";
import { isDesktopLibraryPath } from "@/features/library/model/libraryRegistry";

interface EmptyLibraryStateProps {
  libraryPath: string;
  onCreateBlankProject: () => void;
  onImportMarkdown: () => void;
  onOpenLibrary: () => void;
  onCreateFromTemplate: (templateId: string) => void;
}

export function EmptyLibraryState({
  libraryPath,
  onCreateBlankProject,
  onImportMarkdown,
  onOpenLibrary,
  onCreateFromTemplate,
}: EmptyLibraryStateProps) {
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
          <Button onClick={onCreateBlankProject}>
            <Plus /> 创建空白项目
          </Button>
          <Button variant="outline" onClick={onImportMarkdown}>
            <Download /> 导入 Markdown
          </Button>
          <Button variant="outline" onClick={onOpenLibrary} disabled={!isDesktopLibraryPath(libraryPath)}>
            <FolderOpen /> 打开写作文件夹
          </Button>
        </div>
        <div className="mt-1 grid w-full grid-cols-2 gap-2">
          {PROJECT_TEMPLATES.filter((template) => template.id !== "blank").map((template) => (
            <Button
              key={template.id}
              variant="outline"
              className="h-auto min-w-0 justify-start gap-3 p-3 text-left whitespace-normal"
              onClick={() => onCreateFromTemplate(template.id)}
            >
              <FilePlus2 />
              <span className="min-w-0">
                <strong className="block truncate">{template.title}</strong>
                <small className="mt-1 block text-xs leading-snug font-normal text-muted-foreground">{template.description}</small>
              </span>
            </Button>
          ))}
        </div>
      </section>
    </main>
  );
}
