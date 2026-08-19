/**
 * [INPUT]: 依赖 ProjectDraftDialogs 的公开 props 与 React lazy/Suspense
 * [OUTPUT]: 对外提供 ProjectDraftDialogsHost，将项目/分组草稿 Dialog 的按需加载边界保留在 library feature
 * [POS]: library feature 的项目草稿 surface host；不拥有草稿值、项目保存或发布设置回调
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { lazy, Suspense } from "react";
import type { ProjectDraftDialogsProps } from "@/features/library/components/ProjectDraftDialogs";

const ProjectDraftDialogs = lazy(() =>
  import("@/features/library/components/ProjectDraftDialogs").then((module) => ({ default: module.ProjectDraftDialogs })),
);

export type ProjectDraftDialogsHostProps = ProjectDraftDialogsProps;

export function ProjectDraftDialogsHost(props: ProjectDraftDialogsHostProps) {
  if (!props.projectDialogOpen && !props.groupDialogOpen) return null;
  return (
    <Suspense fallback={null}>
      <ProjectDraftDialogs {...props} />
    </Suspense>
  );
}
