/**
 * [INPUT]: 依赖 Markdown 导入 controller、快速记录打开态与 App 注入的保存回调
 * [OUTPUT]: 对外提供 LibraryImportDialogs，组合"写作库还没有内容时也成立"的录入弹窗
 * [POS]: library feature 的录入弹窗边界；被 onboarding 首屏与主界面共用，因此只依赖导入与随手记，不触碰选择、移动或删除状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { lazy, Suspense } from "react";
import type { MarkdownImportController } from "@/features/library/hooks/useMarkdownImport";

const MarkdownImportDialog = lazy(() =>
  import("@/features/library/components/MarkdownImportDialog").then((module) => ({ default: module.MarkdownImportDialog })),
);
const QuickCaptureDialog = lazy(() =>
  import("@/features/library/components/QuickCaptureDialog").then((module) => ({ default: module.QuickCaptureDialog })),
);

export interface LibraryImportDialogsProps {
  markdownImport: MarkdownImportController;
  quickCaptureOpen: boolean;
  onCloseQuickCapture: () => void;
  onSaveQuickCapture: (body: string) => void;
}

export function LibraryImportDialogs({
  markdownImport,
  quickCaptureOpen,
  onCloseQuickCapture,
  onSaveQuickCapture,
}: LibraryImportDialogsProps) {
  return (
    <>
      {markdownImport.open && (
        <Suspense fallback={null}>
          <MarkdownImportDialog controller={markdownImport} />
        </Suspense>
      )}
      {quickCaptureOpen && (
        <Suspense fallback={null}>
          <QuickCaptureDialog open onClose={onCloseQuickCapture} onSave={onSaveQuickCapture} />
        </Suspense>
      )}
    </>
  );
}
