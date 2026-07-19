import LiquidGlass from "liquid-glass-react";
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
    iconClassName: "text-[#248a3d]",
  },
  error: {
    Icon: CircleX,
    iconClassName: "text-[#d70015]",
  },
  info: {
    Icon: Info,
    iconClassName: "text-[#007aff]",
  },
  warning: {
    Icon: TriangleAlert,
    iconClassName: "text-[#b06a00]",
  },
};

export function AppToast({ variant, title, description, onClose, actionLabel, onAction }: AppToastProps) {
  const { Icon, iconClassName } = APP_TOAST_VARIANTS[variant];

  return (
    <div className="app-toast-glass-shell">
      <LiquidGlass
        className="app-toast-liquid-glass"
        displacementScale={32}
        blurAmount={0.1}
        saturation={180}
        aberrationIntensity={1.8}
        elasticity={0.08}
        cornerRadius={16}
        padding="0"
        overLight
        mode="standard"
        style={{ width: 330 }}
      >
        <div className="app-toast-content">
          <Icon aria-hidden="true" className={`app-toast-icon ${iconClassName}`} strokeWidth={2} />

          <span className="flex min-w-0 flex-1 flex-col items-start justify-center">
            <span className="w-full truncate text-[15px] leading-5 font-semibold text-[#1d1d1f]">{title}</span>
            <span className="w-full truncate text-[13px] leading-[18px] text-[#6e6e73]">{description}</span>
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
      </LiquidGlass>
    </div>
  );
}
