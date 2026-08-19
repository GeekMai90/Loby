/**
 * [INPUT]: 依赖待移动文稿、未使用图片清理状态、项目/分组/文稿/废纸篓的待确认删除状态与 App 注入的确认回调
 * [OUTPUT]: 对外提供 LibraryMaintenanceDialogs、PendingSheetTrash、PendingProjectGroupDelete、UnusedImageCleanupDialogState
 * [POS]: library feature 的维护弹窗边界；只在已有写作库内容的主界面挂载，投影已有状态与回调，不拥有选择状态、删除领域规则或保存队列
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { lazy, Suspense } from "react";
import type { SheetMoveTarget } from "@/features/library/model/projectCreation";
import type { MoveSheetDialogEntry } from "@/features/library/components/MoveSheetDialog";
import type { ProjectGroup, UnusedImageCandidate, WritingProject, WritingSheet } from "@/shared/types";

const ConfirmDialog = lazy(() => import("@/shared/components/ConfirmDialog").then((module) => ({ default: module.ConfirmDialog })));
const MoveSheetDialog = lazy(() =>
  import("@/features/library/components/MoveSheetDialog").then((module) => ({ default: module.MoveSheetDialog })),
);
const UnusedImageCleanupDialog = lazy(() =>
  import("@/features/library/components/UnusedImageCleanupDialog").then((module) => ({ default: module.UnusedImageCleanupDialog })),
);

export type PendingSheetTrash = Array<{ project: WritingProject; sheet: WritingSheet }>;

export interface PendingProjectGroupDelete {
  project: WritingProject;
  group: ProjectGroup;
}

export interface UnusedImageCleanupDialogState {
  candidates: UnusedImageCandidate[];
  selectedPaths: Set<string>;
  dialogOpen: boolean;
  busy: boolean;
  onClose: () => void;
  onTogglePath: (path: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  onPreview: (candidate: UnusedImageCandidate) => void;
  onSaveAs: (candidate: UnusedImageCandidate) => Promise<boolean>;
  onConfirm: () => Promise<void>;
}

export interface LibraryMaintenanceDialogsProps {
  projects: WritingProject[];
  moveEntries: MoveSheetDialogEntry[];
  onCloseMove: () => void;
  onMoveSheets: (sheetIds: string[], target: SheetMoveTarget) => void;
  unusedImageCleanup: UnusedImageCleanupDialogState;
  projectPendingTrash: WritingProject | null;
  onCancelProjectTrash: () => void;
  onConfirmProjectTrash: () => void;
  projectGroupPendingDelete: PendingProjectGroupDelete | null;
  onCancelProjectGroupDelete: () => void;
  onConfirmProjectGroupDelete: () => void;
  sheetPendingTrash: PendingSheetTrash | null;
  onCancelSheetTrash: () => void;
  onConfirmSheetTrash: () => void;
  trashClearPending: boolean;
  onCancelTrashClear: () => void;
  onConfirmTrashClear: () => void;
}

export function LibraryMaintenanceDialogs({
  projects,
  moveEntries,
  onCloseMove,
  onMoveSheets,
  unusedImageCleanup,
  projectPendingTrash,
  onCancelProjectTrash,
  onConfirmProjectTrash,
  projectGroupPendingDelete,
  onCancelProjectGroupDelete,
  onConfirmProjectGroupDelete,
  sheetPendingTrash,
  onCancelSheetTrash,
  onConfirmSheetTrash,
  trashClearPending,
  onCancelTrashClear,
  onConfirmTrashClear,
}: LibraryMaintenanceDialogsProps) {
  const projectGroupSheetCount = projectGroupPendingDelete
    ? projectGroupPendingDelete.project.sheets.filter((sheet) => sheet.groupId === projectGroupPendingDelete.group.id).length
    : 0;

  return (
    <>
      {moveEntries.length > 0 && (
        <Suspense fallback={null}>
          <MoveSheetDialog
            open
            projects={projects}
            entries={moveEntries}
            onClose={onCloseMove}
            onMove={(target) =>
              onMoveSheets(
                moveEntries.map(({ sheet }) => sheet.id),
                target,
              )
            }
          />
        </Suspense>
      )}
      {unusedImageCleanup.dialogOpen && (
        <Suspense fallback={null}>
          <UnusedImageCleanupDialog
            open
            candidates={unusedImageCleanup.candidates}
            selectedPaths={unusedImageCleanup.selectedPaths}
            busy={unusedImageCleanup.busy}
            onClose={unusedImageCleanup.onClose}
            onTogglePath={unusedImageCleanup.onTogglePath}
            onSelectAll={unusedImageCleanup.onSelectAll}
            onPreview={unusedImageCleanup.onPreview}
            onSaveAs={unusedImageCleanup.onSaveAs}
            onConfirm={() => void unusedImageCleanup.onConfirm()}
          />
        </Suspense>
      )}
      {projectPendingTrash && (
        <Suspense fallback={null}>
          <ConfirmDialog
            open
            title="删除项目"
            message={`项目「${projectPendingTrash.title}」会被移入废纸篓，项目下的所有文件也会一起移动。`}
            confirmLabel="移入废纸篓"
            destructive
            onCancel={onCancelProjectTrash}
            onConfirm={onConfirmProjectTrash}
          />
        </Suspense>
      )}
      {projectGroupPendingDelete && (
        <Suspense fallback={null}>
          <ConfirmDialog
            open
            title="删除分组"
            message={
              projectGroupSheetCount > 0
                ? `分组「${projectGroupPendingDelete.group.title}」下的文稿会移动到「待整理」，共 ${projectGroupSheetCount} 篇，文稿内容不会被删除。`
                : `分组「${projectGroupPendingDelete.group.title}」为空，确认删除这个分组吗？`
            }
            confirmLabel={projectGroupSheetCount > 0 ? "删除并移到待整理" : "删除分组"}
            destructive
            onCancel={onCancelProjectGroupDelete}
            onConfirm={onConfirmProjectGroupDelete}
          />
        </Suspense>
      )}
      {sheetPendingTrash && (
        <Suspense fallback={null}>
          <ConfirmDialog
            open
            title="删除文稿"
            message={
              sheetPendingTrash.length > 1
                ? `${sheetPendingTrash.length} 篇文稿会被移入废纸篓，可以稍后恢复。`
                : `文稿「${sheetPendingTrash[0]?.sheet.title ?? ""}」会被移入废纸篓，可以稍后恢复。`
            }
            confirmLabel={sheetPendingTrash.length > 1 ? `移入废纸篓（${sheetPendingTrash.length} 篇）` : "移入废纸篓"}
            destructive
            onCancel={onCancelSheetTrash}
            onConfirm={onConfirmSheetTrash}
          />
        </Suspense>
      )}
      {trashClearPending && (
        <Suspense fallback={null}>
          <ConfirmDialog
            open
            title="清空废纸篓"
            message="废纸篓中的项目、文稿和图片会被移入系统废纸篓，之后仍可通过系统文件管理器恢复。"
            confirmLabel="清空"
            destructive
            onCancel={onCancelTrashClear}
            onConfirm={onConfirmTrashClear}
          />
        </Suspense>
      )}
    </>
  );
}
