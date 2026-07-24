/**
 * [INPUT]: 依赖 shadcn/ui Dialog/Progress/Button、React、写作库重建契约、设置表面与全局 Toast
 * [OUTPUT]: 对外提供 FileStorageSettingsPanel，承载索引确认、阶段进度与结果反馈
 * [POS]: 设置 feature 的本地文件操作界面，不拥有扫描和迁移规则
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useState } from "react";
import { isDesktopLibraryPath } from "@/features/library/model/libraryRegistry";
import type { LibraryRebuildProgress, LibraryRebuildSummary } from "@/features/library/model/persistence";
import { SettingsActionRow, SettingsSection, SettingsValueRow } from "@/features/settings/components/SettingsControls";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { showAppToast } from "@/shared/lib/appToast";

interface FileStorageSettingsPanelProps {
  libraryPath: string;
  libraryStatus: string;
  projectCount: number;
  onOpenLibrary: () => void;
  onMoveLibrary: () => Promise<void>;
  onRebuildLibraryIndex: (onProgress?: (progress: LibraryRebuildProgress) => void) => Promise<LibraryRebuildSummary>;
}

export function FileStorageSettingsPanel({
  libraryPath,
  libraryStatus,
  projectCount,
  onOpenLibrary,
  onMoveLibrary,
  onRebuildLibraryIndex,
}: FileStorageSettingsPanelProps) {
  const [moving, setMoving] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [confirmingRebuild, setConfirmingRebuild] = useState(false);
  const [rebuildProgress, setRebuildProgress] = useState<LibraryRebuildProgress>({
    value: 0,
    label: "正在准备重建索引…",
  });
  const [actionError, setActionError] = useState("");
  const localFolder = isDesktopLibraryPath(libraryPath);

  async function moveLibrary() {
    setMoving(true);
    setActionError("");
    try {
      await onMoveLibrary();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setMoving(false);
    }
  }

  async function rebuildIndex() {
    setConfirmingRebuild(false);
    setRebuilding(true);
    setRebuildProgress({ value: 0, label: "正在准备重建索引…" });
    setActionError("");
    try {
      const summary = await onRebuildLibraryIndex(setRebuildProgress);
      showAppToast({
        variant: "success",
        title: "索引重建完成",
        description:
          summary.migratedSheetCount > 0
            ? `已索引 ${summary.indexedSheetCount} 篇文稿，并统一 ${summary.migratedSheetCount} 篇文稿 ID`
            : `已完成 ${summary.indexedSheetCount} 篇文稿的索引检查`,
      });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setActionError(message);
      showAppToast({ variant: "error", title: "重建索引失败", description: message });
    } finally {
      setRebuilding(false);
    }
  }

  return (
    <SettingsSection title="本地文件">
      <SettingsActionRow
        label="写作文件夹"
        description="所有项目、文稿、图片和便携设置都保存在这个文件夹中。"
        value={folderName(libraryPath)}
        detail={libraryPath}
      >
        <Button type="button" variant="outline" onClick={onOpenLibrary} disabled={!localFolder || moving}>
          打开
        </Button>
        <Button type="button" onClick={() => void moveLibrary()} disabled={!localFolder || moving}>
          {moving ? "正在移动…" : "移动…"}
        </Button>
      </SettingsActionRow>
      <SettingsValueRow label="项目" value={`${projectCount} 个`} />
      <SettingsActionRow
        label="文稿索引"
        description="重新扫描写作文件夹、补齐 Markdown 元数据，并把旧文稿 ID 统一为新的 Base32 格式。"
        detail="重建前会先保存当前内容；已发布文章继续保留原来的公开地址和远端身份。"
      >
        <Button type="button" variant="outline" onClick={() => setConfirmingRebuild(true)} disabled={!localFolder || moving || rebuilding}>
          {rebuilding ? "正在重建…" : "重建索引…"}
        </Button>
      </SettingsActionRow>
      {libraryStatus && <SettingsValueRow label="状态" value={libraryStatus} />}
      {actionError && <SettingsValueRow label="操作失败" value={actionError} />}
      <ConfirmDialog
        open={confirmingRebuild}
        title="重建文稿索引？"
        message="落笔会先保存当前内容，然后重新扫描整个写作文件夹。旧格式或缺失的文稿 ID 会被统一更新，相关本地索引和 AI 对话引用也会同步迁移。"
        confirmLabel="开始重建"
        onCancel={() => setConfirmingRebuild(false)}
        onConfirm={() => void rebuildIndex()}
      />
      <Dialog open={rebuilding}>
        <DialogContent
          showCloseButton={false}
          className="gap-4 sm:max-w-90"
          onEscapeKeyDown={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
        >
          <div>
            <DialogTitle>正在重建文稿索引</DialogTitle>
            <DialogDescription className="mt-1.5">重建期间请保持写作文件夹可用。</DialogDescription>
          </div>
          <div role="status" aria-label={`${rebuildProgress.label}，${rebuildProgress.value}%`}>
            <Progress value={rebuildProgress.value} aria-label={rebuildProgress.label} />
            <div className="mt-2 flex items-center justify-between gap-4 text-[11px] text-muted-foreground">
              <span>{rebuildProgress.label}</span>
              <span className="tabular-nums">{rebuildProgress.value}%</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </SettingsSection>
  );
}

function folderName(path: string): string {
  if (!path) return "未设置";
  return path.split(/[\\/]/).filter(Boolean).at(-1) || path;
}
