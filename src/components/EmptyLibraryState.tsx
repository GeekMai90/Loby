import { Download, FilePlus2, FolderOpen, Library, Plus } from "lucide-react";
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
    <main className="empty-state">
      <section className="empty-state-panel">
        <div className="brand-mark empty-brand-mark">N</div>
        <h1>Nibva</h1>
        <p>当前写作库还没有项目。</p>
        <small>{libraryPath}</small>
        <div className="empty-actions">
          <button className="primary-button" onClick={onCreateBlankProject}>
            <Plus size={16} /> 创建空白项目
          </button>
          <button className="secondary-button" onClick={onImportMarkdown}>
            <Download size={16} /> 导入 Markdown
          </button>
          <button className="secondary-button" onClick={onSwitchLibrary}>
            <FolderOpen size={16} /> 切换写作库
          </button>
          <button className="secondary-button" onClick={onOpenLibrary} disabled={!libraryPath.startsWith("/")}>
            <Library size={16} /> 打开当前库
          </button>
        </div>
        <div className="empty-template-grid">
          {PROJECT_TEMPLATES.filter((template) => template.id !== "blank").map((template) => (
            <button key={template.id} className="template-row" onClick={() => onCreateFromTemplate(template.id)}>
              <FilePlus2 size={15} />
              <span>
                <strong>{template.title}</strong>
                <small>{template.description}</small>
              </span>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
