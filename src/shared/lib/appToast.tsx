/**
 * [INPUT]: 依赖 sonner、shared 公共契约
 * [OUTPUT]: 对外提供 showAppToast
 * [POS]: shared 层的跨功能纯工具或平台适配，不依赖 app 与具体 feature
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { toast } from "sonner";
import { AppToast, type AppToastVariant } from "@/shared/components/AppToast";

interface ShowAppToastOptions {
  variant: AppToastVariant;
  title: string;
  description: string;
  duration?: number;
  id?: string | number;
  actionLabel?: string;
  onAction?: () => void;
}

export function showAppToast({ variant, title, description, duration = 4000, id, actionLabel, onAction }: ShowAppToastOptions) {
  return toast.custom(
    (toastId) => (
      <AppToast
        variant={variant}
        title={title}
        description={description}
        actionLabel={actionLabel}
        onAction={onAction}
        onClose={() => toast.dismiss(toastId)}
      />
    ),
    { duration, id },
  );
}
