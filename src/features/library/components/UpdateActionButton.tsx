/**
 * [INPUT]: 依赖 shadcn/ui Button、lucide-react 图标及 app 注入的更新状态与动作
 * [OUTPUT]: 对外提供 UpdateActionButton
 * [POS]: 更新提醒卡片的唯一操作入口；把可用、下载中与待重启安装三种状态压缩到同一按钮几何内
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Download, LoaderCircle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UpdateActionButtonProps {
  updateBusy: boolean;
  updateInstalling: boolean;
  updateProgress: number | null;
  onClick: () => void;
}

export function UpdateActionButton({ updateBusy, updateInstalling, updateProgress, onClick }: UpdateActionButtonProps) {
  const downloading = updateBusy && !updateInstalling;
  const progress = updateProgress === null ? 0 : Math.min(100, Math.max(0, updateProgress));
  const label = updateInstalling ? "重启安装" : downloading ? (updateProgress === null ? "正在下载" : `正在下载 ${progress}%`) : "立即更新";

  return (
    <Button
      type="button"
      variant="default"
      size="sm"
      className="relative mt-2 w-full justify-center overflow-hidden"
      aria-label={label}
      aria-busy={downloading}
      disabled={downloading}
      data-update-action="true"
      data-update-state={updateInstalling ? "ready-to-install" : downloading ? "downloading" : "available"}
      onClick={onClick}
    >
      {downloading && updateProgress !== null ? (
        <span
          className="pointer-events-none absolute inset-y-0 left-0 bg-primary-foreground/18 transition-[width] duration-300"
          style={{ width: `${progress}%` }}
          aria-hidden="true"
        />
      ) : null}
      <span className="relative inline-flex items-center gap-1">
        {updateInstalling ? (
          <RotateCw className="size-3.5" />
        ) : downloading ? (
          <LoaderCircle className="size-3.5 animate-spin" />
        ) : (
          <Download className="size-3.5" />
        )}
        {label}
      </span>
    </Button>
  );
}
