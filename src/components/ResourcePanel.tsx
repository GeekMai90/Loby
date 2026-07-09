import clsx from "clsx";
import { formatBytes } from "../lib/formatters";
import type { ProjectResourceFile, ProjectResourceText } from "../types";
import type { ProjectResourcePaths } from "../lib/projectModel";

interface ResourcePanelProps {
  resourcePaths: ProjectResourcePaths | null;
  projectResources: ProjectResourceFile[];
  selectedResourcePaths: string[];
  resourceImportStatus: string;
  resourcePreview: ProjectResourceText | null;
  resourcePreviewBusy: boolean;
  onSelectedResourcePathsChange: (paths: string[]) => void;
  onImportAssets: () => void;
  onImportReferences: () => void;
  onOpenResourcePath: (path: string, label: string) => void;
  onPreviewResource: (resource: ProjectResourceFile) => void;
  onClearResourcePreview: () => void;
}

export function ResourcePanel({
  resourcePaths,
  projectResources,
  selectedResourcePaths,
  resourceImportStatus,
  resourcePreview,
  resourcePreviewBusy,
  onSelectedResourcePathsChange,
  onImportAssets,
  onImportReferences,
  onOpenResourcePath,
  onPreviewResource,
  onClearResourcePreview,
}: ResourcePanelProps) {
  return (
    <div className="panel-stack">
      <section className="panel-section">
        <h2>项目资源</h2>
        <div className="resource-path-card">
          <div className="resource-card-header">
            <strong>本地目录</strong>
            {resourcePaths && (
              <button className="text-button" onClick={() => onOpenResourcePath(resourcePaths.project, "项目目录")}>
                打开项目
              </button>
            )}
          </div>
          {resourcePaths ? (
            <>
              <code>{resourcePaths.project}</code>
              <button className="resource-path-button" onClick={() => onOpenResourcePath(resourcePaths.assets, "素材目录")}>
                <small>assets: {resourcePaths.assets}</small>
              </button>
              <button className="resource-path-button" onClick={() => onOpenResourcePath(resourcePaths.references, "参考目录")}>
                <small>references: {resourcePaths.references}</small>
              </button>
              <button className="resource-path-button" onClick={() => onOpenResourcePath(resourcePaths.exports, "导出目录")}>
                <small>exports: {resourcePaths.exports}</small>
              </button>
            </>
          ) : (
            <small>浏览器开发模式没有可写项目目录；请在 Tauri 桌面运行时使用。</small>
          )}
        </div>
      </section>

      <section className="panel-section">
        <h2>资源文件</h2>
        <div className="resource-actions standalone-resource-actions">
          <button className="secondary-button" onClick={onImportAssets}>
            导入素材
          </button>
          <button className="secondary-button" onClick={onImportReferences}>
            导入参考
          </button>
          <button
            className="secondary-button"
            onClick={() => onSelectedResourcePathsChange([])}
            disabled={selectedResourcePaths.length === 0}
          >
            清空 AI 选择
          </button>
        </div>
        {resourceImportStatus && <p className="muted-text resource-import-status">{resourceImportStatus}</p>}
        <p className="muted-text resource-import-status">勾选资源会同步到 AI 面板的 @resources 上下文。</p>
        <div className="resource-file-list">
          {projectResources.map((resource) => (
            <label key={resource.path} className={clsx("resource-file-row", selectedResourcePaths.includes(resource.path) && "selected")}>
              <input
                type="checkbox"
                checked={selectedResourcePaths.includes(resource.path)}
                onChange={() =>
                  onSelectedResourcePathsChange(
                    selectedResourcePaths.includes(resource.path)
                      ? selectedResourcePaths.filter((path) => path !== resource.path)
                      : [...selectedResourcePaths, resource.path],
                  )
                }
              />
              <span>
                <strong>{resource.name}</strong>
                <small>
                  {resource.kind} · {formatBytes(resource.sizeBytes)}
                </small>
              </span>
              <span className="resource-row-actions">
                <button
                  className="text-button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onPreviewResource(resource);
                  }}
                  disabled={resourcePreviewBusy}
                >
                  预览
                </button>
                <button
                  className="text-button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onOpenResourcePath(resource.path, resource.name);
                  }}
                >
                  打开
                </button>
              </span>
            </label>
          ))}
          {projectResources.length === 0 && <small className="muted-text">assets / references / exports 里还没有文件。</small>}
        </div>
        {resourcePreview && (
          <div className="resource-preview">
            <div className="resource-preview-header">
              <strong>{resourcePreview.name}</strong>
              <button className="text-button" onClick={onClearResourcePreview}>
                关闭
              </button>
            </div>
            <small>
              {resourcePreview.status} · {formatBytes(resourcePreview.sizeBytes)}
              {resourcePreview.truncated ? " · 已截断" : ""}
            </small>
            {resourcePreview.status === "loaded" ? (
              <pre>{resourcePreview.content.trim() || "(空文件)"}</pre>
            ) : (
              <p className="muted-text">这个资源不能作为文本预览；图片、PDF 等文件可用系统查看器打开。</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
