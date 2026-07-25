/**
 * [INPUT]: 依赖 shared Dialog/Button/Select/Progress、导入 controller、React 与图标
 * [OUTPUT]: 对外提供 MarkdownImportDialog
 * [POS]: 写作库导入的统一预览窗口，被文件菜单、项目右键和空状态入口复用，只呈现扫描事实与显式提交动作
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { AlertTriangle, CheckCircle2, FileText, Files, FolderOpen, Image, Paperclip } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { MarkdownImportController } from "@/features/library/hooks/useMarkdownImport";
import { isInboxProject } from "@/features/library/model/projectModel";

interface MarkdownImportDialogProps {
  controller: MarkdownImportController;
}

export function MarkdownImportDialog({ controller }: MarkdownImportDialogProps) {
  const {
    open,
    busy,
    phase,
    targetProjectId,
    targetProjects,
    scan,
    result,
    error,
    metadataSummary,
    closeImport,
    resetSource,
    setTargetProjectId,
    selectFiles,
    selectFolder,
    chooseAttachmentFolder,
    confirmImport,
  } = controller;
  const targetProject = targetProjects.find((project) => project.id === targetProjectId);
  const progress = phase === "scanning" ? 35 : phase === "importing" ? 72 : phase === "finished" ? 100 : 0;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && closeImport()}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[min(780px,calc(100vh-48px))] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-[min(720px,calc(100vw-48px))]"
      >
        <DialogHeader className="border-b border-border px-6 pt-6 pb-4">
          <DialogTitle>导入 Markdown</DialogTitle>
          <DialogDescription>自动识别普通 Markdown 和 Obsidian Vault；确认前不会修改来源文件或当前写作库。</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 space-y-5 overflow-y-auto px-6 py-5">
          <section className="space-y-2">
            <label className="mb-2 block text-control font-medium" htmlFor="markdown-import-target">
              导入到
            </label>
            <Select value={targetProjectId} onValueChange={setTargetProjectId} disabled={busy || phase === "finished"}>
              <SelectTrigger id="markdown-import-target" width="full">
                <SelectValue placeholder="选择目标位置" />
              </SelectTrigger>
              <SelectContent>
                {targetProjects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {isInboxProject(project) ? "收件箱" : project.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-caption text-muted-foreground">
              {targetProject && isInboxProject(targetProject)
                ? "收件箱会递归导入全部文稿，但不创建文件夹分组。"
                : "文件夹层级会映射为项目分组，多级目录使用“一级 / 二级”显示。"}
            </p>
          </section>

          {!scan && phase !== "scanning" && (
            <section className="grid gap-3 sm:grid-cols-2">
              <SourceButton
                icon={<Files aria-hidden="true" />}
                title="选择 Markdown 文件"
                description="支持一次选择多篇 .md、.markdown 或 .txt 文稿。"
                onClick={() => void selectFiles()}
              />
              <SourceButton
                icon={<FolderOpen aria-hidden="true" />}
                title="选择文件夹"
                description="递归扫描子文件夹，并自动查找 Obsidian 配置。"
                onClick={() => void selectFolder()}
              />
            </section>
          )}

          {(phase === "scanning" || phase === "importing") && (
            <section className="space-y-3 rounded-xl border border-border bg-muted/30 p-4" role="status">
              <Progress value={progress} aria-label={phase === "scanning" ? "正在扫描导入来源" : "正在导入文稿和图片"} />
              <div className="flex items-center justify-between gap-3 text-caption text-muted-foreground">
                <span>{phase === "scanning" ? "正在识别文稿、元信息和图片…" : "正在复制图片并保存文稿…"}</span>
                <span className="tabular-nums">{progress}%</span>
              </div>
            </section>
          )}

          {scan && phase !== "finished" && (
            <>
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-control font-semibold">
                      {scan.sourceType === "obsidian" ? "已识别为 Obsidian Vault" : "已识别为 Markdown 文档"}
                    </h3>
                    <p className="mt-1 truncate text-caption text-muted-foreground" title={scan.vaultRoot || scan.sourcePaths[0]}>
                      {scan.vaultRoot || scan.sourcePaths[0]}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={resetSource} disabled={busy}>
                    更换来源
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <SummaryCard icon={<FileText />} value={scan.documents.length} label="篇文稿" />
                  <SummaryCard icon={<Image />} value={scan.resolvedImageCount} label="张本地图片" />
                  <SummaryCard icon={<CheckCircle2 />} value={scan.externalImageCount} label="张外部图片" />
                  <SummaryCard icon={<AlertTriangle />} value={scan.missingImageCount + scan.ambiguousImageCount} label="项需确认" />
                </div>
              </section>

              <section className="space-y-2 rounded-xl border border-border p-4">
                <div className="flex items-start gap-3">
                  <Paperclip className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-control font-medium">附件识别</h3>
                    {scan.attachmentRoot ? (
                      <p className="mt-1 break-all text-caption text-muted-foreground">已自动找到：{scan.attachmentRoot}</p>
                    ) : (
                      <p className="mt-1 text-caption text-muted-foreground">没有检测到独立附件目录，将继续使用文稿相对路径。</p>
                    )}
                    {(scan.missingImageCount > 0 || scan.ambiguousImageCount > 0) && (
                      <p className="mt-2 text-caption text-status-warning">
                        {scan.missingImageCount > 0 ? `${scan.missingImageCount} 张图片未找到` : ""}
                        {scan.missingImageCount > 0 && scan.ambiguousImageCount > 0 ? "，" : ""}
                        {scan.ambiguousImageCount > 0 ? `${scan.ambiguousImageCount} 张图片存在多个候选` : ""}。继续导入会保留原引用。
                      </p>
                    )}
                  </div>
                  <Button variant="outline" size="sm" onClick={() => void chooseAttachmentFolder()} disabled={busy}>
                    选择附件目录
                  </Button>
                </div>
              </section>

              <section className="grid gap-3 sm:grid-cols-2">
                <MetadataCard title="将保留或转换" keys={metadataSummary.preservedKeys} empty="没有可匹配的元信息" />
                <MetadataCard title="将丢弃" keys={metadataSummary.droppedKeys} empty="没有需要丢弃的元信息" muted />
              </section>

              <section className="space-y-2">
                <h3 className="text-control font-medium">文稿预览</h3>
                <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                  {scan.documents.slice(0, 6).map((document) => (
                    <div key={document.path} className="flex items-center justify-between gap-4 px-3 py-2.5 text-control">
                      <span className="truncate" title={document.relativePath}>
                        {document.relativePath}
                      </span>
                      <span className="shrink-0 text-caption text-muted-foreground">
                        {document.imageReferences.length > 0 ? `${document.imageReferences.length} 张图片` : "无图片"}
                      </span>
                    </div>
                  ))}
                  {scan.documents.length > 6 && (
                    <div className="px-3 py-2.5 text-caption text-muted-foreground">另外 {scan.documents.length - 6} 篇文稿</div>
                  )}
                </div>
                {scan.skippedFileCount > 0 && (
                  <p className="text-caption text-muted-foreground">另有 {scan.skippedFileCount} 个非 Markdown 文件不会导入。</p>
                )}
              </section>
              {scan.warnings.length > 0 && (
                <section className="rounded-xl border border-status-warning/30 bg-[var(--status-warning-soft)] p-4">
                  <h3 className="text-control font-medium text-status-warning">扫描提醒</h3>
                  <ul className="mt-2 space-y-1 text-caption text-status-warning">
                    {scan.warnings.slice(0, 5).map((warning) => (
                      <li key={warning}>• {warning}</li>
                    ))}
                    {scan.warnings.length > 5 && <li>• 另外 {scan.warnings.length - 5} 项提醒</li>}
                  </ul>
                </section>
              )}
            </>
          )}

          {phase === "finished" && result && (
            <section className="flex min-h-64 flex-col items-center justify-center text-center">
              <span className="mb-4 grid size-12 place-items-center rounded-full bg-status-success/10 text-status-success">
                <CheckCircle2 className="size-6" aria-hidden="true" />
              </span>
              <h3 className="text-base font-semibold">导入完成</h3>
              <p className="mt-2 max-w-md text-body text-muted-foreground">
                已导入 {result.importedSheets.length} 篇文稿、创建 {result.createdGroups.length} 个分组
                {result.skippedDuplicateCount > 0 ? `，跳过 ${result.skippedDuplicateCount} 篇重复内容` : ""}。
              </p>
            </section>
          )}

          {error && (
            <div
              className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2.5 text-control text-destructive"
              role="alert"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-border px-6 py-4">
          {phase === "finished" ? (
            <Button onClick={closeImport}>完成</Button>
          ) : (
            <>
              <Button variant="outline" onClick={closeImport} disabled={busy}>
                取消
              </Button>
              <Button onClick={() => void confirmImport()} disabled={!scan || busy}>
                {phase === "importing" ? "正在导入…" : "开始导入"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SourceButton({ icon, title, description, onClick }: { icon: ReactNode; title: string; description: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="flex min-h-32 items-start gap-3 rounded-xl border border-border p-4 text-left transition-colors hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={onClick}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground [&_svg]:size-4">{icon}</span>
      <span>
        <span className="block text-control font-semibold">{title}</span>
        <span className="mt-1.5 block text-caption leading-relaxed text-muted-foreground">{description}</span>
      </span>
    </button>
  );
}

function SummaryCard({ icon, value, label }: { icon: ReactNode; value: number; label: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-3">
      <span className="text-muted-foreground [&_svg]:size-4">{icon}</span>
      <strong className="mt-2 block text-base tabular-nums">{value}</strong>
      <span className="text-caption text-muted-foreground">{label}</span>
    </div>
  );
}

function MetadataCard({ title, keys, empty, muted = false }: { title: string; keys: string[]; empty: string; muted?: boolean }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <h3 className="text-control font-medium">{title}</h3>
      {keys.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {keys.map((key) => (
            <span
              key={key}
              className={
                muted
                  ? "rounded-md bg-muted px-2 py-1 text-caption text-muted-foreground"
                  : "rounded-md bg-primary/10 px-2 py-1 text-caption text-primary"
              }
            >
              {key}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-caption text-muted-foreground">{empty}</p>
      )}
    </div>
  );
}
