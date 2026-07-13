import type { ReactNode } from "react";

export function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h4 className="text-xs font-bold text-muted-foreground">{title}</h4>
      <div className="overflow-hidden rounded-lg border border-border bg-card">{children}</div>
    </section>
  );
}

export function SettingsRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid min-h-12 grid-cols-[minmax(120px,0.8fr)_minmax(0,1.2fr)] items-center gap-3.5 border-b border-border px-3 py-2.25 last:border-b-0 max-[1180px]:grid-cols-[minmax(112px,0.8fr)_minmax(0,1.2fr)]">
      <span className="min-w-0 text-[13px] font-medium text-foreground">{label}</span>
      <div className="flex min-w-0 justify-end">{children}</div>
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

export function SettingsActionRow({ label, value, children }: { label: string; value?: string; children: ReactNode }) {
  return (
    <SettingsRow label={label}>
      <div className="flex min-w-0 items-center justify-end gap-2">
        {value && <span className="max-w-45 truncate text-right text-xs text-muted-foreground">{value}</span>}
        {children}
      </div>
    </SettingsRow>
  );
}
