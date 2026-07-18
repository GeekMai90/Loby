import { Download, FilePlus2, FolderOpen, Library, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PROJECT_TEMPLATES } from "../constants/projectTemplates";

interface EmptyLibraryStateProps {
  libraryPath: string;
  onCreateBlankProject: () => void;
  onImportMarkdown: () => void;
  onSwitchLibrary: () => void;
  onOpenLibrary: () => void;
  onCreateFromTemplate: (templateId: string) => void;
}

export function EmptyLibraryState({
  libraryPath,
  onCreateBlankProject,
  onImportMarkdown,
  onSwitchLibrary,
  onOpenLibrary,
  onCreateFromTemplate,
}: EmptyLibraryStateProps) {
  return (
    <main className="grid h-screen place-content-center bg-background text-center">
      <section className="grid w-[min(640px,calc(100vw-48px))] justify-items-center gap-3.5 rounded-lg border border-border bg-card p-8.5">
        <div className="grid size-9.5 place-items-center rounded-lg border border-white/70 bg-linear-to-b from-white/90 to-white/60 font-extrabold text-primary shadow-[0_1px_2px_rgb(0_0_0_/_5%),inset_0_1px_0_rgb(255_255_255_/_78%)]">
          N
        </div>
        <h1 className="m-0">落笔</h1>
        <p className="m-0">当前写作库还没有项目。</p>
        <small className="max-w-full truncate text-xs text-muted-foreground">{libraryPath}</small>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={onCreateBlankProject}>
            <Plus /> 创建空白项目
          </Button>
          <Button variant="outline" onClick={onImportMarkdown}>
            <Download /> 导入 Markdown
          </Button>
          <Button variant="outline" onClick={onSwitchLibrary}>
            <FolderOpen /> 切换写作库
          </Button>
          <Button variant="outline" onClick={onOpenLibrary} disabled={!libraryPath.startsWith("/")}>
            <Library /> 打开当前库
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
