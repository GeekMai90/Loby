/**
 * [INPUT]: 依赖 ProjectPublishingSettings 的公开 props 与 React lazy/Suspense
 * [OUTPUT]: 对外提供 ProjectPublishingSettingsHost，将项目发布设置附加 surface 的按需加载边界保留在 publishing feature
 * [POS]: publishing feature 的项目设置 surface host；不拥有项目草稿、发布目标 registry 或项目持久化
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { lazy, Suspense } from "react";
import type { ProjectPublishingSettingsProps } from "@/features/publishing/components/ProjectPublishingSettings";

const ProjectPublishingSettings = lazy(() =>
  import("@/features/publishing/components/ProjectPublishingSettings").then((module) => ({
    default: module.ProjectPublishingSettings,
  })),
);

export type ProjectPublishingSettingsHostProps = ProjectPublishingSettingsProps;

export function ProjectPublishingSettingsHost(props: ProjectPublishingSettingsHostProps) {
  return (
    <Suspense fallback={null}>
      <ProjectPublishingSettings {...props} />
    </Suspense>
  );
}
