/**
 * [INPUT]: 依赖当前项目/文稿、发布目标与摘要生成器、文稿元信息写回回调以及公众号/直接发布/GitHub 博客 lazy surface
 * [OUTPUT]: 对外提供 DocumentPublishingDialogs，统一组合当前文稿的公众号、WordPress/墨问与 GitHub 博客发布对话框
 * [POS]: publishing feature 的文稿发布 overlay 边界；不拥有发布状态机、项目选择或持久化，只把 app 的当前上下文映射到各渠道对话框
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { lazy, Suspense } from "react";
import type {
  DocumentSummaryGenerator,
  GitHubPublishingTargetPublication,
  PublishingTargetPublication,
  WritingProject,
  WritingSheet,
} from "@/shared/types";
import type { GitHubBlogPublishingTarget } from "@/features/publishing/model/publishingTargets";

const WechatPublishDialog = lazy(() =>
  import("@/features/publishing/components/WechatPublishDialog").then((module) => ({
    default: module.WechatPublishDialog,
  })),
);
const DirectPublishDialog = lazy(() =>
  import("@/features/publishing/components/DirectPublishDialog").then((module) => ({
    default: module.DirectPublishDialog,
  })),
);
const BlogPublishDialog = lazy(() =>
  import("@/features/publishing/components/BlogPublishDialog").then((module) => ({
    default: module.BlogPublishDialog,
  })),
);

export type DirectPublishChannel = "wordpress" | "mowen";

export interface DocumentPublishingDialogsProps {
  project: WritingProject | undefined;
  activeSheet: WritingSheet | undefined;
  publishingSheet: WritingSheet | null | undefined;
  libraryPath: string;
  wechatPublishOpen: boolean;
  directPublishChannel: DirectPublishChannel | null;
  blogTarget: GitHubBlogPublishingTarget | undefined;
  onCloseWechat: () => void;
  onCloseDirect: () => void;
  onCloseBlog: () => void;
  onOpenImageHostingSettings: () => void;
  onOpenSettings: () => void;
  onGenerateSummary?: DocumentSummaryGenerator;
  onUpdateSheet: (updater: (sheet: WritingSheet) => WritingSheet) => void;
  onPublished: (targetId: string, publication: PublishingTargetPublication | GitHubPublishingTargetPublication) => void;
}

export function DocumentPublishingDialogs({
  project,
  activeSheet,
  publishingSheet,
  libraryPath,
  wechatPublishOpen,
  directPublishChannel,
  blogTarget,
  onCloseWechat,
  onCloseDirect,
  onCloseBlog,
  onOpenImageHostingSettings,
  onOpenSettings,
  onGenerateSummary,
  onUpdateSheet,
  onPublished,
}: DocumentPublishingDialogsProps) {
  if (!project || !activeSheet) return null;

  return (
    <Suspense fallback={null}>
      {wechatPublishOpen && (
        <WechatPublishDialog
          open
          project={project}
          sheet={publishingSheet ?? activeSheet}
          libraryPath={libraryPath}
          onClose={onCloseWechat}
          onOpenImageHostingSettings={onOpenImageHostingSettings}
          onOpenSettings={onOpenSettings}
          onGenerateSummary={onGenerateSummary}
          onUpdateSheet={onUpdateSheet}
          onPublished={onPublished}
        />
      )}
      {directPublishChannel && (
        <DirectPublishDialog
          open
          channel={directPublishChannel}
          project={project}
          sheet={activeSheet}
          libraryPath={libraryPath}
          onClose={onCloseDirect}
          onOpenSettings={onOpenSettings}
          onGenerateSummary={onGenerateSummary}
          onUpdateSheet={onUpdateSheet}
        />
      )}
      {blogTarget && (
        <BlogPublishDialog
          open
          project={project}
          sheet={activeSheet}
          target={blogTarget}
          libraryPath={libraryPath}
          onClose={onCloseBlog}
          onOpenSettings={onOpenSettings}
          onGenerateSummary={onGenerateSummary}
          onUpdateSheet={onUpdateSheet}
          onPublished={onPublished}
        />
      )}
    </Suspense>
  );
}
