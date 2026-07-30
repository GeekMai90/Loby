/**
 * [INPUT]: 依赖 shadcn/ui、公众号草稿发布状态、文稿与主题摘要、共享发布打字机反馈与进度条
 * [OUTPUT]: 对外提供 WechatDraftPublishState、WechatDraftPublishView，统一呈现字符/图片、发布位置、主题与封面信息
 * [POS]: publishing feature 的公众号草稿纯视图，与墨问/GitHub 发布共享信息层级及确认、发布中、成功和错误交互语法
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Check, CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PublishTypewriterLoader } from "@/features/publishing/components/PublishTypewriterLoader";

export type WechatDraftPublishState = "ready" | "publishing" | "success" | "error";

interface WechatDraftPublishViewProps {
  state: WechatDraftPublishState;
  title: string;
  characterCount: number;
  imageCount: number;
  themeName: string;
  coverDetail: string;
  wasPublished: boolean;
  progress: number;
  progressLabel: string;
  errorMessage: string;
  errorNeedsSettings: boolean;
  desktopAvailable: boolean;
  onCancel: () => void;
  onPublish: () => void;
  onOpenSettings: () => void;
}

export function WechatDraftPublishView({
  state,
  title,
  characterCount,
  imageCount,
  themeName,
  coverDetail,
  wasPublished,
  progress,
  progressLabel,
  errorMessage,
  errorNeedsSettings,
  desktopAvailable,
  onCancel,
  onPublish,
  onOpenSettings,
}: WechatDraftPublishViewProps) {
  return (
    <>
      {state === "ready" ? (
        <div key={state} className="direct-publish-body flex h-52 shrink-0 flex-col">
          <div className="mt-6 px-0.5">
            <strong className="block truncate text-subtitle">{title}</strong>
            <small className="mt-1 block truncate text-caption text-muted-foreground">
              {characterCount} 个字符 · {imageCount} 张图片
            </small>
          </div>
          <div className="mt-4 divide-y divide-border/50 border-t border-border/70">
            <div className="flex min-h-9 items-center justify-between gap-6 py-2 text-app-base">
              <span className="shrink-0 font-medium text-foreground">发布位置</span>
              <span className="min-w-0 truncate text-right text-muted-foreground">公众号草稿箱</span>
            </div>
            <div className="flex min-h-9 items-center justify-between gap-6 py-2 text-app-base">
              <span className="shrink-0 font-medium text-foreground">使用主题</span>
              <span className="min-w-0 truncate text-right text-muted-foreground" title={themeName}>
                {themeName}
              </span>
            </div>
            <div className="flex min-h-9 items-center justify-between gap-6 py-2 text-app-base">
              <span className="shrink-0 font-medium text-foreground">封面图片</span>
              <span className="min-w-0 truncate text-right text-muted-foreground" title={coverDetail}>
                {coverDetail}
              </span>
            </div>
          </div>
        </div>
      ) : state === "publishing" ? (
        <div
          key={state}
          className="direct-publish-body flex h-52 shrink-0 flex-col items-center justify-center px-0.5 pt-5 pb-1"
          role="status"
          aria-label={`${progressLabel}，${progress}%`}
        >
          <PublishTypewriterLoader />
          <div className="mt-8 w-full">
            <Progress value={progress} aria-label={progressLabel} />
            <p className="mt-2 text-center text-[11px] text-muted-foreground">{progressLabel}</p>
          </div>
        </div>
      ) : state === "success" ? (
        <div
          key={state}
          className="direct-publish-body flex h-52 shrink-0 flex-col items-center justify-center px-6 pt-5 pb-1 text-center"
          role="status"
        >
          <span className="direct-publish-message-icon success grid size-11.5 place-items-center rounded-full bg-status-success text-status-success-foreground shadow-lg shadow-status-success/20">
            <Check size={24} strokeWidth={2.4} />
          </span>
          <h3 className="mt-3.5 text-base font-semibold">已推送到草稿箱</h3>
          <p className="mt-1.5 max-w-100 truncate text-xs leading-5 text-muted-foreground" title={title}>
            《{title}》已保存到公众号草稿箱。
          </p>
          <p className="mt-1 text-[10px] text-muted-foreground">请到公众号后台检查后自行发布。</p>
        </div>
      ) : (
        <div
          key={state}
          className="direct-publish-body flex h-52 shrink-0 flex-col items-center justify-center px-6 pt-5 pb-1 text-center"
          role="alert"
        >
          <span className="grid size-11.5 place-items-center rounded-full bg-destructive/10 text-destructive">
            <CircleAlert size={22} />
          </span>
          <h3 className="mt-3.5 text-base font-semibold">{errorNeedsSettings ? "需要完成公众号设置" : "草稿推送失败"}</h3>
          <p className="mt-1.5 max-w-100 text-xs leading-5 text-muted-foreground">{errorMessage || "暂时无法推送，请稍后重试。"}</p>
        </div>
      )}

      {!desktopAvailable ? <p className="mt-3 text-[10px] text-destructive">请在落笔桌面应用中推送公众号草稿。</p> : null}
      <footer className="mt-4.5 flex min-h-9 justify-end gap-2">
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
            <Button
              type="button"
              disabled={!desktopAvailable}
              onClick={state === "error" && errorNeedsSettings ? onOpenSettings : onPublish}
            >
              {state === "error" ? (errorNeedsSettings ? "前往设置" : "重试") : wasPublished ? "更新" : "发布"}
            </Button>
          </>
        )}
      </footer>
    </>
  );
}
