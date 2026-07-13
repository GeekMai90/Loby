import { Check, CircleAlert, KeyRound } from "lucide-react";

export type MowenPublishState = "checking" | "unconfigured" | "ready" | "publishing" | "success" | "error";

interface MowenPublishViewProps {
  state: MowenPublishState;
  title: string;
  characterCount: number;
  progress: number;
  progressLabel: string;
  errorMessage: string;
  errorNeedsSettings: boolean;
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
  onCancel,
  onPublish,
  onOpenSettings,
}: MowenPublishViewProps) {
  return (
    <>
      <div key={state} className="mowen-publish-body flex min-h-44 flex-1 flex-col">
        {(state === "ready" || state === "checking" || state === "publishing") && (
          <DocumentSummary title={title} characterCount={characterCount} />
        )}

        {state === "checking" && (
          <div className="mt-auto px-0.5 pt-5.5 pb-1" role="status">
            <div
              className="mowen-publish-progress-track indeterminate relative h-1 overflow-hidden rounded-full bg-muted"
              aria-hidden="true"
            >
              <span className="block h-full rounded-full bg-primary" />
            </div>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">正在检查发布设置…</p>
          </div>
        )}

        {state === "unconfigured" && (
          <div className="flex min-h-44 flex-col items-center justify-center px-6 pt-5 pb-1 text-center">
            <span className="grid size-11.5 place-items-center rounded-full bg-muted text-muted-foreground">
              <KeyRound size={21} />
            </span>
            <h3 className="mt-3.5 text-base font-semibold">需要先配置墨问笔记</h3>
            <p className="mt-1.5 max-w-100 truncate text-xs leading-5 text-muted-foreground">发布前请先前往设置验证 API Key。</p>
          </div>
        )}

        {state === "publishing" && (
          <div className="mt-auto px-0.5 pt-5.5 pb-1" role="status" aria-label={`${progressLabel}，${progress}%`}>
            <Progress value={progress} aria-label={progressLabel} />
            <p className="mt-2 text-center text-[11px] text-muted-foreground">{progressLabel}</p>
          </div>
        )}

        {state === "success" && (
          <div className="flex min-h-44 flex-col items-center justify-center px-6 pt-5 pb-1 text-center" role="status">
            <span className="mowen-publish-message-icon success grid size-11.5 place-items-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/20">
              <Check size={24} strokeWidth={2.4} />
            </span>
            <h3 className="mt-3.5 text-base font-semibold">发布成功</h3>
            <p className="mt-1.5 max-w-100 truncate text-xs leading-5 text-muted-foreground" title={title}>
              《{title}》已发布到墨问笔记。
            </p>
          </div>
        )}

        {state === "error" && (
          <div className="flex min-h-44 flex-col items-center justify-center px-6 pt-5 pb-1 text-center" role="alert">
            <span className="grid size-11.5 place-items-center rounded-full bg-destructive/10 text-destructive">
              <CircleAlert size={22} />
            </span>
            <h3 className="mt-3.5 text-base font-semibold">发布失败</h3>
            <p className="mt-1.5 max-w-100 text-xs leading-5 text-muted-foreground">{errorMessage || "暂时无法发布，请稍后重试。"}</p>
          </div>
        )}
      </div>

      <footer className="mt-4 flex min-h-9 items-center justify-end gap-2">
        {state === "success" ? (
          <Button type="button" onClick={onCancel}>
            完成
          </Button>
        ) : state === "publishing" || state === "checking" ? (
          <Button type="button" disabled>
            {state === "publishing" ? "发布中…" : "检查中…"}
          </Button>
        ) : (
          <>
            <Button type="button" variant="outline" onClick={onCancel}>
              取消
            </Button>
            <Button type="button" onClick={state === "unconfigured" || errorNeedsSettings ? onOpenSettings : onPublish}>
              {state === "unconfigured" || errorNeedsSettings ? "前往设置" : state === "error" ? "重试" : "发布"}
            </Button>
          </>
        )}
      </footer>
    </>
  );
}

function DocumentSummary({ title, characterCount }: { title: string; characterCount: number }) {
  return (
    <div className="mt-5.5 rounded-lg border border-border bg-muted/40 p-3">
      <strong className="block truncate text-[13px]">{title}</strong>
      <small className="mt-1 block truncate text-[11px] text-muted-foreground">{characterCount} 个字符 · 公开发布</small>
    </div>
  );
}
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
