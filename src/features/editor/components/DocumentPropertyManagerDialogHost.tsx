/**
 * [INPUT]: 依赖 DocumentPropertyManagerDialog 的公开 props 与 React lazy/Suspense
 * [OUTPUT]: 对外提供 DocumentPropertyManagerDialogHost，将文稿属性管理 surface 的按需加载边界保留在 editor feature
 * [POS]: editor feature 的属性管理 surface host；不拥有字段草稿、迁移确认或项目持久化
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { lazy, Suspense } from "react";
import type { DocumentPropertyManagerDialogProps } from "@/features/editor/components/DocumentPropertyManagerDialog";

const DocumentPropertyManagerDialog = lazy(() =>
  import("@/features/editor/components/DocumentPropertyManagerDialog").then((module) => ({
    default: module.DocumentPropertyManagerDialog,
  })),
);

export type DocumentPropertyManagerDialogHostProps = DocumentPropertyManagerDialogProps;

export function DocumentPropertyManagerDialogHost(props: DocumentPropertyManagerDialogHostProps) {
  if (!props.open || !props.project) return null;
  return (
    <Suspense fallback={null}>
      <DocumentPropertyManagerDialog {...props} />
    </Suspense>
  );
}
