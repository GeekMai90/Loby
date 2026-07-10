import type { ReactNode } from "react";

export function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="settings-section">
      <h4>{title}</h4>
      <div className="settings-section-body">{children}</div>
    </section>
  );
}

export function SettingsRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="settings-row">
      <span className="settings-row-label">{label}</span>
      <div className="settings-row-control">{children}</div>
    </div>
  );
}

export function SettingsValueRow({ label, value }: { label: string; value: string }) {
  return (
    <SettingsRow label={label}>
      <span className="settings-value-text" title={value}>
        {value}
      </span>
    </SettingsRow>
  );
}

export function SettingsActionRow({ label, value, children }: { label: string; value?: string; children: ReactNode }) {
  return (
    <SettingsRow label={label}>
      <div className="settings-action-control">
        {value && <span className="settings-value-text">{value}</span>}
        {children}
      </div>
    </SettingsRow>
  );
}
