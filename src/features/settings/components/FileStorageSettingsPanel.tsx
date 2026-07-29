/**
 * [INPUT]: 依赖 shadcn/ui Dialog/Progress/Button、React、写作库重建契约、设置表面、确认流程与全局 Toast
 * [OUTPUT]: 对外提供 FileStorageSettingsPanel，以“写作文件夹”和“维护”分组承载当前目录、移动、切换与索引重建
 * [POS]: settings feature 的本地文件操作界面；只编排选择、确认和反馈，不拥有目录初始化、扫描与迁移规则
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useState } from "react";
import { isDesktopLibraryPath } from "@/features/library/model/libraryRegistry";
import type { LibraryRebuildProgress, LibraryRebuildSummary } from "@/features/library/model/persistence";
import { SettingsActionRow, SettingsSection } from "@/features/settings/components/SettingsControls";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { showAppToast } from "@/shared/lib/appToast";

interface FileStorageSettingsPanelProps {
  libraryPath: string;
  onRevealLibrary: () => void;
  onOpenExistingLibrary: () => Promise<void>;
  onMoveLibrary: () => Promise<void>;
  onRebuildLibraryIndex: (onProgress?: (progress: LibraryRebuildProgress) => void) => Promise<LibraryRebuildSummary>;
}

export function FileStorageSettingsPanel({
  libraryPath,
  onRevealLibrary,
  onOpenExistingLibrary,
  onMoveLibrary,
  onRebuildLibraryIndex,
}: FileStorageSettingsPanelProps) {
  const [moving, setMoving] = useState(false);
  const [opening, setOpening] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [confirmingMove, setConfirmingMove] = useState(false);
  const [confirmingRebuild, setConfirmingRebuild] = useState(false);
  const [rebuildProgress, setRebuildProgress] = useState<LibraryRebuildProgress>({
    value: 0,
    label: "正在准备重建索引…",
  });
  const localFolder = isDesktopLibraryPath(libraryPath);

  async function moveLibrary() {
    setConfirmingMove(false);
    setMoving(true);
    try {
      await onMoveLibrary();
    } catch (cause) {
      showAppToast({ variant: "error", title: "移动写作文件夹失败", description: errorMessage(cause) });
    } finally {
      setMoving(false);
    }
  }

  async function openExistingLibrary() {
    setOpening(true);
    try {
      await onOpenExistingLibrary();
    } catch (cause) {
      showAppToast({ variant: "error", title: "切换写作文件夹失败", description: errorMessage(cause) });
    } finally {
      setOpening(false);
    }
  }

  async function rebuildIndex() {
    setConfirmingRebuild(false);
    setRebuilding(true);
    setRebuildProgress({ value: 0, label: "正在准备重建索引…" });
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
      showAppToast({ variant: "error", title: "重建索引失败", description: message });
    } finally {
      setRebuilding(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <SettingsSection title="写作文件夹">
        <SettingsActionRow
          label="当前写作文件夹"
          description="所有项目、文稿、图片和便携设置都保存在这个文件夹中。"
          value={folderName(libraryPath)}
          detail={libraryPath}
        >
          <Button type="button" variant="outline" onClick={onRevealLibrary} disabled={!localFolder || moving || opening}>
            在文件管理器中显示
          </Button>
        </SettingsActionRow>
        <SettingsActionRow label="移动写作文件夹" description="将当前写作文件夹及其中的全部内容移动到新位置，并继续使用它。">
          <Button
            type="button"
            variant="outline"
            onClick={() => setConfirmingMove(true)}
            disabled={!localFolder || moving || opening || rebuilding}
          >
            {moving ? "正在移动…" : "选择新位置…"}
          </Button>
        </SettingsActionRow>
        <SettingsActionRow label="切换写作文件夹" description="保留当前写作文件夹，改用另一个落笔写作文件夹；选择空文件夹时会自动初始化。">
          <Button type="button" variant="outline" onClick={() => void openExistingLibrary()} disabled={moving || opening || rebuilding}>
            {opening ? "正在切换…" : "选择文件夹…"}
          </Button>
        </SettingsActionRow>
      </SettingsSection>

      <SettingsSection title="维护">
        <SettingsActionRow label="文稿索引" description="重新扫描写作文件夹、补齐 Markdown 元数据，并把旧文稿 ID 统一为新的 Base32 格式。">
          <Button
            type="button"
            variant="outline"
            onClick={() => setConfirmingRebuild(true)}
            disabled={!localFolder || moving || opening || rebuilding}
          >
            {rebuilding ? "正在重建…" : "重建索引…"}
          </Button>
        </SettingsActionRow>
      </SettingsSection>

      <ConfirmDialog
        open={confirmingMove}
        title="移动写作文件夹？"
        message="选择新位置后，落笔会保存当前内容并移动整个写作文件夹。原位置将不再保留这个文件夹，完成后会继续使用新位置。"
        confirmLabel="选择新位置"
        onCancel={() => setConfirmingMove(false)}
        onConfirm={() => void moveLibrary()}
      />
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
    </div>
  );
}

function folderName(path: string): string {
  if (!path) return "未设置";
  return path.split(/[\\/]/).filter(Boolean).at(-1) || path;
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
