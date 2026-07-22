/**
 * [INPUT]: 依赖 lucide-react、发布模块、shared 公共契约、shadcn/ui 与 Animate UI Tabs
 * [OUTPUT]: 对外提供 MowenPublishState、MowenPublishView
 * [POS]: 发布 feature 的界面组合单元，连接 发布 状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Check, CircleAlert, Globe2, LockKeyhole } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/animate-ui/components/animate/tabs";
import type { MowenVisibility } from "@/features/publishing/model/api";
import { MowenTypewriterLoader } from "@/features/publishing/components/MowenTypewriterLoader";

export type MowenPublishState = "ready" | "publishing" | "success" | "error";

const MOWEN_VISIBILITY_TABS = [
  { value: "public", label: "公开", icon: Globe2 },
  { value: "private", label: "私密", icon: LockKeyhole },
] as const;

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
      <div key={state} className="mowen-publish-body flex h-52 shrink-0 flex-col">
        {state === "ready" && (
          <DocumentSummary title={title} characterCount={characterCount} visibility={visibility} onVisibilityChange={onVisibilityChange} />
        )}

        {state === "publishing" && (
          <div
            className="flex h-full flex-col items-center justify-center px-0.5 pt-5 pb-1"
            role="status"
            aria-label={`${progressLabel}，${progress}%`}
          >
            <MowenTypewriterLoader />
            <div className="mt-8 w-full">
              <Progress value={progress} aria-label={progressLabel} />
              <p className="mt-2 text-center text-[11px] text-muted-foreground">{progressLabel}</p>
            </div>
          </div>
        )}

        {state === "success" && (
          <div className="flex h-full flex-col items-center justify-center px-6 pt-5 pb-1 text-center" role="status">
            <span className="mowen-publish-message-icon success grid size-11.5 place-items-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/20">
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

function DocumentSummary({
  title,
  characterCount,
  visibility,
  onVisibilityChange,
}: {
  title: string;
  characterCount: number;
  visibility: MowenVisibility;
  onVisibilityChange: (visibility: MowenVisibility) => void;
}) {
  return (
    <div className="mt-6">
      <div className="px-0.5">
        <strong className="block truncate text-sm">{title}</strong>
        <small className="mt-1 block truncate text-[11px] text-muted-foreground">{characterCount} 个字符</small>
      </div>
      <div className="mt-5 flex items-center justify-between gap-4 border-t border-border/70 pt-4">
        <span className="min-w-0">
          <span className="block text-xs font-medium">可见范围</span>
          <small className="mt-1 block text-[10px] text-muted-foreground">{visibility === "public" ? "所有人可查看" : "仅自己可见"}</small>
        </span>
        <Tabs value={visibility} onValueChange={(value) => onVisibilityChange(value as MowenVisibility)} className="w-40 shrink-0">
          <TabsList className="grid w-full grid-cols-2" aria-label="墨问笔记可见范围">
            {MOWEN_VISIBILITY_TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger key={tab.value} value={tab.value}>
                  <Icon aria-hidden="true" />
                  <span>{tab.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      </div>
    </div>
  );
}
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
