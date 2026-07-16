import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { SettingsRow } from "./SettingsRows";

export function SettingsToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <SettingsRow label={label}>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
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
      <div className="grid w-full max-w-57.5 grid-cols-[minmax(0,1fr)_48px] items-center gap-2.5">
        <Slider min={min} max={max} step={step} value={[value]} onValueChange={([nextValue]) => onChange(nextValue)} />
        <span className="text-right text-xs text-muted-foreground">
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
      <ToggleGroup
        type="single"
        variant="outline"
        spacing={0}
        value={value}
        onValueChange={(nextValue) => nextValue && onChange(nextValue as TValue)}
      >
        {options.map((option) => (
          <ToggleGroupItem key={option.value} value={option.value} className="min-w-18">
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </SettingsRow>
  );
}

export function SettingsTextField({
  label,
  description,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  description?: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <SettingsRow label={label} description={description}>
      <Input className="max-w-70" value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </SettingsRow>
  );
}

export function SettingsSelect<TValue extends string>({
  label,
  value,
  options,
  triggerClassName,
  onChange,
}: {
  label: string;
  value: TValue;
  options: Array<{ value: TValue; label: string }>;
  triggerClassName?: string;
  onChange: (value: TValue) => void;
}) {
  return (
    <SettingsRow label={label}>
      <Select value={value} onValueChange={(nextValue) => onChange(nextValue as TValue)}>
        <SelectTrigger className={cn("w-full max-w-45", triggerClassName)}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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
      <div className="flex min-w-0 items-center justify-end gap-1.5">
        <Input
          className="w-19"
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
        {unit && <span className="min-w-5 text-xs text-muted-foreground">{unit}</span>}
      </div>
    </SettingsRow>
  );
}
