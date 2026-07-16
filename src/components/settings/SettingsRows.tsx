import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CircleHelp } from "lucide-react";
import type { ReactNode } from "react";

export function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h4 className="text-xs font-bold text-muted-foreground">{title}</h4>
      <div className="overflow-hidden rounded-lg border border-border bg-card">{children}</div>
    </section>
  );
}

export function SettingsRow({
  label,
  description,
  detail,
  children,
}: {
  label: string;
  description?: string;
  detail?: string;
  children: ReactNode;
}) {
  return (
    <div className="border-b border-border last:border-b-0">
      <div className="grid min-h-12 grid-cols-[minmax(120px,0.8fr)_minmax(0,1.2fr)] items-center gap-3.5 px-3 py-2.25 max-[1180px]:grid-cols-[minmax(112px,0.8fr)_minmax(0,1.2fr)]">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="min-w-0 text-[13px] font-medium text-foreground">{label}</span>
          {description && (
            <TooltipProvider delayDuration={350}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                    aria-label={`${label}说明`}
                  >
                    <CircleHelp size={13} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={6} className="max-w-72 text-center leading-4 whitespace-normal break-words">
                  {description}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <div className="flex min-w-0 justify-end">{children}</div>
      </div>
      {detail && <p className="m-0 px-3 pb-2 text-[11px] leading-4 text-muted-foreground break-all">{detail}</p>}
    </div>
  );
}

export function SettingsValueRow({ label, value }: { label: string; value: string }) {
  return (
    <SettingsRow label={label}>
      <span className="min-w-0 truncate text-right text-xs text-muted-foreground" title={value}>
        {value}
      </span>
    </SettingsRow>
  );
}

export function SettingsActionRow({
  label,
  description,
  value,
  detail,
  children,
}: {
  label: string;
  description?: string;
  value?: string;
  detail?: string;
  children: ReactNode;
}) {
  return (
    <SettingsRow label={label} description={description} detail={detail}>
      <div className="flex min-w-0 items-center justify-end gap-2">
        {value && <span className="max-w-45 truncate text-right text-xs text-muted-foreground">{value}</span>}
        {children}
      </div>
    </SettingsRow>
  );
}
