/**
 * [INPUT]: 依赖 shadcn/ui、帮助中心同步结果、共享发布打字机反馈与 GitHub 文档站展示状态
 * [OUTPUT]: 对外提供 HelpCenterSyncState、HelpCenterSyncView，统一呈现确认、同步中、成功和错误状态
 * [POS]: publishing feature 的 GitHub 文档站纯视图，与墨问发布共享固定几何、进度反馈和恢复语法，由 HelpCenterSyncDialog 持有副作用
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Check, CircleAlert, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { PublishTypewriterLoader } from "@/features/publishing/components/PublishTypewriterLoader";
import type { HelpCenterSyncResult } from "@/features/publishing/model/api";

export type HelpCenterSyncState = "ready" | "syncing" | "success" | "error";

interface HelpCenterSyncViewProps {
  state: HelpCenterSyncState;
  mode: "document" | "project";
  title: string;
  targetName: string;
  detail: string;
  siteUrl: string;
  documentUrl: string;
  wasSynced: boolean;
  deleteMissing: boolean;
  progress: number;
  progressLabel: string;
  errorMessage: string;
  errorNeedsSettings: boolean;
  result: HelpCenterSyncResult | null;
  configReady: boolean;
  onDeleteMissingChange: (deleteMissing: boolean) => void;
  onCancel: () => void;
  onSync: () => void;
  onOpenSettings: () => void;
}

export function HelpCenterSyncView({
  state,
  mode,
  title,
  targetName,
  detail,
  siteUrl,
  documentUrl,
  wasSynced,
  deleteMissing,
  progress,
  progressLabel,
  errorMessage,
  errorNeedsSettings,
  result,
  configReady,
  onDeleteMissingChange,
  onCancel,
  onSync,
  onOpenSettings,
}: HelpCenterSyncViewProps) {
  return (
    <>
      <div key={state} className="direct-publish-body flex h-52 shrink-0 flex-col">
        {state === "ready" && (
          <div className="mt-6">
            <div className="px-0.5">
              <strong className="block truncate text-sm">{title}</strong>
              <small className="mt-1 block truncate text-[11px] text-muted-foreground">{detail}</small>
            </div>
            <div className="mt-5 flex items-center justify-between gap-4 border-t border-border/70 pt-4">
              <span className="min-w-0">
                <span className="block text-xs font-medium">同步目标</span>
                <small className="mt-1 block text-[10px] text-muted-foreground">{targetName}</small>
              </span>
              {mode === "project" ? (
                <label className="flex shrink-0 items-center gap-3 text-right">
                  <span>
                    <span className="block text-[11px] font-medium text-foreground">清理远端缺失文稿</span>
                    <small className="mt-0.5 block text-[9px] text-muted-foreground">仅清理本项目曾声明的文稿</small>
                  </span>
                  <Switch checked={deleteMissing} onCheckedChange={onDeleteMissingChange} aria-label="清理远端缺失文稿" />
                </label>
              ) : null}
            </div>
          </div>
        )}

        {state === "syncing" && (
          <div
            className="flex h-full flex-col items-center justify-center px-0.5 pt-5 pb-1"
            role="status"
            aria-label={`${progressLabel}，${progress}%`}
          >
            <PublishTypewriterLoader />
            <div className="mt-8 w-full">
              <Progress value={progress} aria-label={progressLabel} />
              <p className="mt-2 text-center text-[11px] text-muted-foreground">{progressLabel}</p>
            </div>
          </div>
        )}

        {state === "success" && (
          <div className="flex h-full flex-col items-center justify-center px-6 pt-5 pb-1 text-center" role="status">
            <span className="direct-publish-message-icon success grid size-11.5 place-items-center rounded-full bg-status-success text-status-success-foreground shadow-lg shadow-status-success/20">
              <Check size={24} strokeWidth={2.4} />
            </span>
            <h3 className="mt-3.5 text-base font-semibold">同步成功</h3>
            <p className="mt-1.5 max-w-100 truncate text-xs leading-5 text-muted-foreground" title={title}>
              {mode === "document" ? `《${title}》已同步到${targetName}。` : `已将 ${result?.syncedCount ?? 0} 篇文稿同步到${targetName}。`}
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {result?.changed ? "GitHub 提交已创建" : "远端内容已经是最新版本"}
              {result?.commitSha ? ` · ${result.commitSha.slice(0, 8)}` : ""}
            </p>
          </div>
        )}

        {state === "error" && (
          <div className="flex h-full flex-col items-center justify-center px-6 pt-5 pb-1 text-center" role="alert">
            <span className="grid size-11.5 place-items-center rounded-full bg-destructive/10 text-destructive">
              <CircleAlert size={22} />
            </span>
            <h3 className="mt-3.5 text-base font-semibold">{errorNeedsSettings ? "需要完成 GitHub 设置" : "同步失败"}</h3>
            <p className="mt-1.5 max-w-100 text-xs leading-5 text-muted-foreground">{errorMessage || "暂时无法同步，请稍后重试。"}</p>
          </div>
        )}
      </div>

      <footer className="mt-6 flex min-h-9 items-center justify-end gap-2">
        {state === "success" ? (
          <>
            {documentUrl ? (
              <Button type="button" variant="outline" asChild>
                <a href={documentUrl} target="_blank" rel="noreferrer">
                  <ExternalLink aria-hidden="true" />
                  打开文稿
                </a>
              </Button>
            ) : null}
            <Button type="button" variant="outline" asChild>
              <a href={siteUrl} target="_blank" rel="noreferrer">
                <ExternalLink aria-hidden="true" />
                打开网站
              </a>
            </Button>
            <Button type="button" onClick={onCancel}>
              完成
            </Button>
          </>
        ) : state === "syncing" ? (
          <>
            <Button type="button" variant="outline" disabled>
              取消
            </Button>
            <Button type="button" disabled>
              同步中…
            </Button>
          </>
        ) : (
          <>
            <Button type="button" variant="outline" onClick={onCancel}>
              取消
            </Button>
            <Button
              type="button"
              disabled={state === "ready" && !configReady}
              onClick={state === "error" && errorNeedsSettings ? onOpenSettings : onSync}
            >
              {state === "error"
                ? errorNeedsSettings
                  ? "前往设置"
                  : "重试"
                : mode === "document"
                  ? wasSynced
                    ? "更新"
                    : "同步"
                  : "同步整个项目"}
            </Button>
          </>
        )}
      </footer>
    </>
  );
}
