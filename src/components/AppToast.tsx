import { CircleCheck, CircleX, Info, TriangleAlert, X, type LucideIcon } from "lucide-react";

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
  accentClassName: string;
  iconSurfaceClassName: string;
  waveClassName: string;
}

const TOAST_WAVE_PATH =
  "M0,256L11.4,240C22.9,224,46,192,69,192C91.4,192,114,224,137,234.7C160,245,183,235,206,213.3C228.6,192,251,160,274,149.3C297.1,139,320,149,343,181.3C365.7,213,389,267,411,282.7C434.3,299,457,277,480,250.7C502.9,224,526,192,549,181.3C571.4,171,594,181,617,208C640,235,663,277,686,256C708.6,235,731,149,754,122.7C777.1,96,800,128,823,165.3C845.7,203,869,245,891,224C914.3,203,937,117,960,112C982.9,107,1006,181,1029,197.3C1051.4,213,1074,171,1097,144C1120,117,1143,107,1166,133.3C1188.6,160,1211,224,1234,218.7C1257.1,213,1280,139,1303,133.3C1325.7,128,1349,192,1371,192C1394.3,192,1417,128,1429,96L1440,64L1440,320L1428.6,320C1417.1,320,1394,320,1371,320C1348.6,320,1326,320,1303,320C1280,320,1257,320,1234,320C1211.4,320,1189,320,1166,320C1142.9,320,1120,320,1097,320C1074.3,320,1051,320,1029,320C1005.7,320,983,320,960,320C937.1,320,914,320,891,320C868.6,320,846,320,823,320C800,320,777,320,754,320C731.4,320,709,320,686,320C662.9,320,640,320,617,320C594.3,320,571,320,549,320C525.7,320,503,320,480,320C457.1,320,434,320,411,320C388.6,320,366,320,343,320C320,320,297,320,274,320C251.4,320,229,320,206,320C182.9,320,160,320,137,320C114.3,320,91,320,69,320C45.7,320,23,320,11,320L0,320Z";

const APP_TOAST_VARIANTS: Record<AppToastVariant, AppToastVariantStyle> = {
  success: {
    Icon: CircleCheck,
    accentClassName: "text-[#269b24]",
    iconSurfaceClassName: "bg-[#04e40048]",
    waveClassName: "text-[#04e4003a]",
  },
  error: {
    Icon: CircleX,
    accentClassName: "text-[#d10d0d]",
    iconSurfaceClassName: "bg-[#fc0c0c48]",
    waveClassName: "text-[#fc0c0c3a]",
  },
  info: {
    Icon: Info,
    accentClassName: "text-[#124fff]",
    iconSurfaceClassName: "bg-[#4777ff48]",
    waveClassName: "text-[#4777ff3a]",
  },
  warning: {
    Icon: TriangleAlert,
    accentClassName: "text-[#db970e]",
    iconSurfaceClassName: "bg-[#ffa30d48]",
    waveClassName: "text-[#ffa30d3a]",
  },
};

export function AppToast({ variant, title, description, onClose, actionLabel, onAction }: AppToastProps) {
  const { Icon, accentClassName, iconSurfaceClassName, waveClassName } = APP_TOAST_VARIANTS[variant];

  return (
    <div className="relative flex h-20 w-[330px] items-center gap-[15px] overflow-hidden rounded-lg bg-popover px-[15px] py-2.5 text-popover-foreground shadow-[0_8px_24px_rgb(149_157_165_/_20%)] ring-1 ring-black/[0.03]">
      <svg
        aria-hidden="true"
        className={`pointer-events-none absolute top-8 -left-[31px] w-20 rotate-90 fill-current ${waveClassName}`}
        viewBox="0 0 1440 320"
      >
        <path d={TOAST_WAVE_PATH} />
      </svg>

      <span className={`relative z-10 ml-2 flex size-[35px] shrink-0 items-center justify-center rounded-full ${iconSurfaceClassName}`}>
        <Icon aria-hidden="true" className={`size-[17px] ${accentClassName}`} strokeWidth={2.25} />
      </span>

      <span className="relative z-10 flex min-w-0 flex-1 flex-col items-start justify-center">
        <span className={`w-full truncate text-[17px] leading-[22px] font-bold ${accentClassName}`}>{title}</span>
        <span className="w-full truncate text-sm leading-5 text-muted-foreground">{description}</span>
      </span>

      {actionLabel && onAction && (
        <button
          type="button"
          className="relative z-10 shrink-0 rounded-md px-2 py-1 text-sm font-medium text-primary transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          onClick={() => {
            onAction();
            onClose();
          }}
        >
          {actionLabel}
        </button>
      )}

      <button
        type="button"
        className="relative z-10 -mr-1 flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        aria-label="关闭提示"
        onClick={onClose}
      >
        <X aria-hidden="true" className="size-[18px]" strokeWidth={2} />
      </button>
    </div>
  );
}
