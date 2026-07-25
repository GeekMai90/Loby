/**
 * [INPUT]: 依赖 lucide-react 与 shadcn/ui Button
 * [OUTPUT]: 对外提供 WechatImageHostButtonStatus、WechatImageHostButton
 * [POS]: 发布 feature 的界面组合单元，连接 发布 状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Check, CloudUpload, Loader2, Settings2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export type WechatImageHostButtonStatus = "idle" | "uploading" | "success" | "error";

interface WechatImageHostButtonProps {
  configured: boolean;
  settingsReady: boolean;
  localImageCount: number;
  uploadedImageCount: number;
  status: WechatImageHostButtonStatus;
  message?: string;
  onUpload: () => void;
  onOpenSettings: () => void;
}

export function WechatImageHostButton({
  configured,
  settingsReady,
  localImageCount,
  uploadedImageCount,
  status,
  message,
  onUpload,
  onOpenSettings,
}: WechatImageHostButtonProps) {
  const allUploaded = localImageCount > 0 && uploadedImageCount >= localImageCount;
  const disabled = !settingsReady || status === "uploading" || (configured && (localImageCount === 0 || allUploaded));
  const label = resolveLabel({ configured, settingsReady, localImageCount, uploadedImageCount, status, message });
  const icon = !configured ? (
    <Settings2 />
  ) : status === "uploading" ? (
    <Loader2 className="animate-spin" />
  ) : status === "error" ? (
    <TriangleAlert />
  ) : allUploaded || status === "success" ? (
    <Check />
  ) : (
    <CloudUpload />
  );

  return (
    <Button
      type="button"
      size="icon"
      variant={status === "error" ? "destructive" : "ghost"}
      className={allUploaded || status === "success" ? "bg-[var(--button-icon-hover-background)] text-foreground" : undefined}
      disabled={disabled}
      data-tooltip={label}
      aria-label={label}
      aria-live="polite"
      data-wechat-image-host-button
      data-no-window-drag
      onClick={configured ? onUpload : onOpenSettings}
    >
      {icon}
    </Button>
  );
}

function resolveLabel({
  configured,
  settingsReady,
  localImageCount,
  uploadedImageCount,
  status,
  message,
}: Omit<WechatImageHostButtonProps, "onUpload" | "onOpenSettings">): string {
  if (!settingsReady) return "正在读取图床设置";
  if (!configured) return "配置图床";
  if (status === "uploading") return `正在上传本地图片（${uploadedImageCount}/${localImageCount}）`;
  if (status === "error") return message || "图片上传失败，请重试";
  if (localImageCount === 0) return "当前文章没有需要上传的本地图片";
  if (uploadedImageCount >= localImageCount) return `已上传 ${uploadedImageCount} 张图片，复制排版即可使用`;
  return `上传 ${localImageCount - uploadedImageCount} 张本地图片到图床`;
}
