import clsx from "clsx";
import type { ReactNode } from "react";

export function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="settings-section">
      <h4>{title}</h4>
      <div className="settings-section-body">{children}</div>
    </section>
  );
}

function SettingsRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="settings-row">
      <span className="settings-row-label">{label}</span>
      <div className="settings-row-control">{children}</div>
    </div>
  );
}

export function SettingsToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <SettingsRow label={label}>
      <button
        type="button"
        className={clsx("settings-switch", checked && "checked")}
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
      >
        <span />
      </button>
    </SettingsRow>
  );
}

export function SettingsRange({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  return (
    <SettingsRow label={label}>
      <div className="settings-range-control">
        <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
        <span>
          {value}
          {unit}
        </span>
      </div>
    </SettingsRow>
  );
}

export function SettingsSegmentedControl<TValue extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: TValue;
  options: Array<{ value: TValue; label: string }>;
  onChange: (value: TValue) => void;
}) {
  return (
    <SettingsRow label={label}>
      <div className="settings-segmented-control">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={clsx(value === option.value && "active")}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </SettingsRow>
  );
}

export function SettingsTextField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <SettingsRow label={label}>
      <input className="settings-text-input" value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </SettingsRow>
  );
}

export function SettingsSelect<TValue extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: TValue;
  options: Array<{ value: TValue; label: string }>;
  onChange: (value: TValue) => void;
}) {
  return (
    <SettingsRow label={label}>
      <select className="settings-select" value={value} onChange={(event) => onChange(event.target.value as TValue)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </SettingsRow>
  );
}

export function SettingsNumberField({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  return (
    <SettingsRow label={label}>
      <div className="settings-number-control">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => {
            const nextValue = Number(event.target.value);
            if (Number.isFinite(nextValue)) onChange(nextValue);
          }}
        />
        {unit && <span>{unit}</span>}
      </div>
    </SettingsRow>
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
