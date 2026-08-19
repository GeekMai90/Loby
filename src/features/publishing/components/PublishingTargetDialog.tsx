/**
 * [INPUT]: 依赖项目发布绑定、应用级 publishing target store、项目摘要生成器与 Hugo/Starlight 对话框动态边界
 * [OUTPUT]: 对外提供 PublishingTargetDialogRequest、PublishingTargetDialogProps、PublishingTargetDialog
 * [POS]: publishing feature 的目标对话框 host；只解析已绑定且可用的目标并选择对应渠道 surface，不拥有项目状态或发布结果写回
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { lazy, Suspense } from "react";
import type { DocumentSummaryGenerator, WritingProject } from "@/shared/types";
import { isPublishingTargetReady, publishingTargetById, type PublishingTargetStore } from "@/features/publishing/model/publishingTargets";

const HugoBatchPublishDialog = lazy(() =>
  import("@/features/publishing/components/HugoBatchPublishDialog").then((module) => ({
    default: module.HugoBatchPublishDialog,
  })),
);
const HelpCenterSyncDialog = lazy(() =>
  import("@/features/publishing/components/HelpCenterSyncDialog").then((module) => ({
    default: module.HelpCenterSyncDialog,
  })),
);

export interface PublishingTargetDialogRequest {
  projectId: string;
  targetId?: string;
  sheetId?: string;
}

export interface PublishingTargetDialogProps {
  request: PublishingTargetDialogRequest | null;
  projects: WritingProject[];
  publishingTargets: PublishingTargetStore;
  libraryPath: string;
  onClose: () => void;
  onOpenSettings: () => void;
  onGenerateSummary?: DocumentSummaryGenerator;
  onProjectChange: (project: WritingProject) => void;
}

export function PublishingTargetDialog({
  request,
  projects,
  publishingTargets,
  libraryPath,
  onClose,
  onOpenSettings,
  onGenerateSummary,
  onProjectChange,
}: PublishingTargetDialogProps) {
  if (!request) return null;

  const project = projects.find((item) => item.id === request.projectId);
  const target = publishingTargetById(publishingTargets, request.targetId ?? project?.publishingBinding?.targetId);
  if (!project || !target || !isPublishingTargetReady(target)) return null;

  const onOpenChange = (open: boolean) => {
    if (!open) onClose();
  };

  if (target.kind === "githubHugoBlog") {
    return (
      <Suspense fallback={null}>
        <HugoBatchPublishDialog
          open
          libraryPath={libraryPath}
          project={project}
          target={target}
          onOpenChange={onOpenChange}
          onOpenSettings={onOpenSettings}
          onProjectChange={onProjectChange}
        />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={null}>
      <HelpCenterSyncDialog
        open
        libraryPath={libraryPath}
        project={project}
        target={target}
        sheetId={request.sheetId}
        onOpenChange={onOpenChange}
        onOpenSettings={onOpenSettings}
        onGenerateSummary={onGenerateSummary}
        onProjectChange={onProjectChange}
      />
    </Suspense>
  );
}
