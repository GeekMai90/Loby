/**
 * [INPUT]: 依赖 clsx、shadcn/ui 基础控件、shared 公共契约、写作库模块
 * [OUTPUT]: 对外提供 ResourcePanel
 * [POS]: 编辑器 feature 的界面组合单元，连接 编辑器 状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import clsx from "clsx";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { formatBytes } from "@/shared/lib/formatters";
import type { ProjectResourceFile, ProjectResourceText } from "@/shared/types";
import type { ProjectResourcePaths } from "@/features/library/model/projectModel";

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
    <div className="flex flex-col gap-[var(--panel-gap)] pr-0.5">
      <section className="rounded-lg border border-border bg-card p-3">
        <h2 className="mb-3 text-sm font-semibold">项目资源</h2>
        <div className="mb-2 flex flex-col gap-1.5 rounded-lg border border-border bg-card p-2">
          <div className="flex items-center justify-between gap-2">
            <strong className="text-xs">本地目录</strong>
            {resourcePaths && (
              <Button variant="ghost" size="sm" onClick={() => onOpenResourcePath(resourcePaths.project, "项目目录")}>
                打开项目
              </Button>
            )}
          </div>
          {resourcePaths ? (
            <>
              <code className="truncate font-mono text-[10px] text-muted-foreground">{resourcePaths.project}</code>
              <Button
                variant="link"
                className="h-auto min-w-0 justify-start p-0 text-left"
                onClick={() => onOpenResourcePath(resourcePaths.assets, "素材目录")}
              >
                <small className="truncate font-mono text-[10px] text-muted-foreground">assets: {resourcePaths.assets}</small>
              </Button>
              <Button
                variant="link"
                className="h-auto min-w-0 justify-start p-0 text-left"
                onClick={() => onOpenResourcePath(resourcePaths.references, "参考目录")}
              >
                <small className="truncate font-mono text-[10px] text-muted-foreground">references: {resourcePaths.references}</small>
              </Button>
              <Button
                variant="link"
                className="h-auto min-w-0 justify-start p-0 text-left"
                onClick={() => onOpenResourcePath(resourcePaths.exports, "导出目录")}
              >
                <small className="truncate font-mono text-[10px] text-muted-foreground">exports: {resourcePaths.exports}</small>
              </Button>
            </>
          ) : (
            <small className="truncate font-mono text-[10px] text-muted-foreground">
              浏览器开发模式没有可写项目目录；请在 Tauri 桌面运行时使用。
            </small>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-3">
        <h2 className="mb-3 text-sm font-semibold">资源文件</h2>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={onImportAssets}>
            导入素材
          </Button>
          <Button variant="outline" onClick={onImportReferences}>
            导入参考
          </Button>
          <Button variant="outline" onClick={() => onSelectedResourcePathsChange([])} disabled={selectedResourcePaths.length === 0}>
            清空 AI 选择
          </Button>
        </div>
        {resourceImportStatus && <p className="mb-2 text-xs leading-4.5 break-words text-muted-foreground">{resourceImportStatus}</p>}
        <p className="mb-2 text-xs leading-4.5 break-words text-muted-foreground">勾选资源会同步到 AI 面板的 @resources 上下文。</p>
        <div className="grid max-h-27 gap-1.5 overflow-auto">
          {projectResources.map((resource) => (
            <label
              key={resource.path}
              className={clsx(
                "grid grid-cols-[16px_minmax(0,1fr)_auto] items-start gap-2 rounded-lg border border-transparent bg-card p-2 text-foreground",
                selectedResourcePaths.includes(resource.path) && "border-primary/35 bg-secondary",
              )}
            >
              <Checkbox
                checked={selectedResourcePaths.includes(resource.path)}
                onCheckedChange={() =>
                  onSelectedResourcePathsChange(
                    selectedResourcePaths.includes(resource.path)
                      ? selectedResourcePaths.filter((path) => path !== resource.path)
                      : [...selectedResourcePaths, resource.path],
                  )
                }
              />
              <span className="min-w-0">
                <strong className="block truncate text-xs">{resource.name}</strong>
                <small className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                  {resource.kind} · {formatBytes(resource.sizeBytes)}
                </small>
              </span>
              <span className="inline-flex self-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onPreviewResource(resource);
                  }}
                  disabled={resourcePreviewBusy}
                >
                  预览
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onOpenResourcePath(resource.path, resource.name);
                  }}
                >
                  打开
                </Button>
              </span>
            </label>
          ))}
          {projectResources.length === 0 && (
            <small className="text-xs leading-4.5 text-muted-foreground">assets / references / exports 里还没有文件。</small>
          )}
        </div>
        {resourcePreview && (
          <div className="mt-2 flex flex-col gap-1.5 rounded-lg border border-border bg-card p-2">
            <div className="flex items-center justify-between gap-2">
              <strong className="truncate text-xs">{resourcePreview.name}</strong>
              <Button variant="ghost" size="sm" onClick={onClearResourcePreview}>
                关闭
              </Button>
            </div>
            <small className="text-[11px] text-muted-foreground">
              {resourcePreview.status} · {formatBytes(resourcePreview.sizeBytes)}
              {resourcePreview.truncated ? " · 已截断" : ""}
            </small>
            {resourcePreview.status === "loaded" ? (
              <pre className="m-0 max-h-45 overflow-auto rounded-md bg-muted/40 p-2 font-mono text-[11px] leading-[1.55] whitespace-pre-wrap text-foreground break-words">
                {resourcePreview.content.trim() || "(空文件)"}
              </pre>
            ) : (
              <p className="text-xs leading-4.5 text-muted-foreground">这个资源不能作为文本预览；图片、PDF 等文件可用系统查看器打开。</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
