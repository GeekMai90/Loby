/**
 * [INPUT]: 依赖 lucide-react、PublishDocumentSummary、发布模块、shared 公共契约与 shadcn/ui
 * [OUTPUT]: 对外提供 MowenPublishState、MowenPublishView
 * [POS]: 发布 feature 的界面组合单元，连接 发布 状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Check, CircleAlert } from "lucide-react";
import type { MowenVisibility } from "@/features/publishing/model/api";
import { PublishDocumentSummary } from "@/features/publishing/components/PublishDocumentSummary";
import { PublishTypewriterLoader } from "@/features/publishing/components/PublishTypewriterLoader";

export type MowenPublishState = "ready" | "publishing" | "success" | "error";

interface MowenPublishViewProps {
  state: MowenPublishState;
  title: string;
  characterCount: number;
  progress: number;
  progressLabel: string;
  errorMessage: string;
  errorNeedsSettings: boolean;
  visibility: MowenVisibility;
  onVisibilityChange: (visibility: MowenVisibility) => void;
  onCancel: () => void;
  onPublish: () => void;
  onOpenSettings: () => void;
}

export function MowenPublishView({
  state,
  title,
  characterCount,
  progress,
  progressLabel,
  errorMessage,
  errorNeedsSettings,
  visibility,
  onVisibilityChange,
  onCancel,
  onPublish,
  onOpenSettings,
}: MowenPublishViewProps) {
  return (
    <>
      <div key={state} className="direct-publish-body flex h-52 shrink-0 flex-col">
        {state === "ready" && (
          <PublishDocumentSummary
            title={title}
            detail={`${characterCount} 个字符`}
            visibility={visibility}
            visibilityLabel="墨问笔记可见范围"
            onVisibilityChange={onVisibilityChange}
          />
        )}

        {state === "publishing" && (
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
            <span className="direct-publish-message-icon success grid size-11.5 place-items-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/20">
              <Check size={24} strokeWidth={2.4} />
            </span>
            <h3 className="mt-3.5 text-base font-semibold">{visibility === "public" ? "发布成功" : "保存成功"}</h3>
            <p className="mt-1.5 max-w-100 truncate text-xs leading-5 text-muted-foreground" title={title}>
              《{title}》{visibility === "public" ? "已发布到墨问笔记。" : "已保存为私密笔记。"}
            </p>
          </div>
        )}

        {state === "error" && (
          <div className="flex h-full flex-col items-center justify-center px-6 pt-5 pb-1 text-center" role="alert">
            <span className="grid size-11.5 place-items-center rounded-full bg-destructive/10 text-destructive">
              <CircleAlert size={22} />
            </span>
            <h3 className="mt-3.5 text-base font-semibold">发布失败</h3>
            <p className="mt-1.5 max-w-100 text-xs leading-5 text-muted-foreground">{errorMessage || "暂时无法发布，请稍后重试。"}</p>
          </div>
        )}
      </div>

      <footer className="mt-6 flex min-h-9 items-center justify-end gap-2">
        {state === "success" ? (
          <Button type="button" onClick={onCancel}>
            完成
          </Button>
        ) : state === "publishing" ? (
          <>
            <Button type="button" variant="outline" disabled>
              取消
            </Button>
            <Button type="button" disabled>
              发布中…
            </Button>
          </>
        ) : (
          <>
            <Button type="button" variant="outline" onClick={onCancel}>
              取消
            </Button>
            <Button type="button" onClick={state === "error" && errorNeedsSettings ? onOpenSettings : onPublish}>
              {state === "error" ? (errorNeedsSettings ? "前往设置" : "重试") : "发布"}
            </Button>
          </>
        )}
      </footer>
    </>
  );
}
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
