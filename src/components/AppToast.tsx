import { CircleCheck, CircleX, Info, TriangleAlert, type LucideIcon } from "lucide-react";

export type AppToastVariant = "success" | "error" | "info" | "warning";

export interface AppToastProps {
  variant: AppToastVariant;
  title: string;
  description: string;
  onClose: () => void;
  actionLabel?: string;
  onAction?: () => void;
}

interface AppToastVariantStyle {
  Icon: LucideIcon;
  iconClassName: string;
}

const APP_TOAST_VARIANTS: Record<AppToastVariant, AppToastVariantStyle> = {
  success: {
    Icon: CircleCheck,
    iconClassName: "text-[var(--toast-success)]",
  },
  error: {
    Icon: CircleX,
    iconClassName: "text-[var(--toast-error)]",
  },
  info: {
    Icon: Info,
    iconClassName: "text-primary",
  },
  warning: {
    Icon: TriangleAlert,
    iconClassName: "text-[var(--toast-warning)]",
  },
};

export function AppToast({ variant, title, description, onClose, actionLabel, onAction }: AppToastProps) {
  const { Icon, iconClassName } = APP_TOAST_VARIANTS[variant];

  return (
    <div className="app-toast-surface">
      <div className="app-toast-content">
        <Icon aria-hidden="true" className={`app-toast-icon ${iconClassName}`} strokeWidth={2} />

        <span className="flex min-w-0 flex-1 flex-col items-start justify-center">
          <span className="w-full truncate text-[15px] leading-5 font-semibold text-[var(--toast-title)]">{title}</span>
          <span className="w-full truncate text-[13px] leading-[18px] text-[var(--toast-description)]">{description}</span>
        </span>

        {actionLabel && onAction && (
          <button
            type="button"
            className="app-toast-action"
            onClick={() => {
              onAction();
              onClose();
            }}
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
