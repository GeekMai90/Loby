/**
 * [INPUT]: 依赖 shadcn/ui 基础控件、shared 公共契约、设置模块
 * [OUTPUT]: 对外提供 SettingsToggle、SettingsRange、SettingsTextField、支持独立 trigger/content 宽度、fit 弹层自适应、popup 对齐与禁用态的 SettingsSelect、SettingsNumberField
 * [POS]: 设置 feature 的界面组合单元，连接 设置 状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  type SelectContentWidth,
  SelectItem,
  SelectTrigger,
  type SelectTriggerWidth,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/shared/lib/utils";
import { SettingsRow } from "@/features/settings/components/SettingsRows";

export function SettingsToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <SettingsRow label={label} description={description}>
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

export function SettingsTextField({
  label,
  description,
  value,
  placeholder,
  type = "text",
  onChange,
}: {
  label: string;
  description?: string;
  value: string;
  placeholder: string;
  type?: "text" | "password";
  onChange: (value: string) => void;
}) {
  return (
    <SettingsRow label={label} description={description}>
      <Input
        className="max-w-70"
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={type === "password" ? "off" : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
    </SettingsRow>
  );
}

export function SettingsSelect<TValue extends string>({
  label,
  description,
  value,
  options,
  width = "full",
  contentWidth,
  contentAlign = "start",
  triggerClassName,
  disabled = false,
  onChange,
}: {
  label: string;
  description?: string;
  value: TValue;
  options: Array<{ value: TValue; label: string }>;
  width?: SelectTriggerWidth;
  contentWidth?: SelectContentWidth;
  contentAlign?: "start" | "center" | "end";
  triggerClassName?: string;
  disabled?: boolean;
  onChange: (value: TValue) => void;
}) {
  const resolvedContentWidth = contentWidth ?? (width === "fit" ? "fit" : "trigger");

  return (
    <SettingsRow label={label} description={description}>
      <Select value={value} disabled={disabled} onValueChange={(nextValue) => onChange(nextValue as TValue)}>
        <SelectTrigger aria-label={label} width={width} className={cn(width === "full" && "max-w-45", triggerClassName)}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent width={resolvedContentWidth} align={contentAlign}>
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
