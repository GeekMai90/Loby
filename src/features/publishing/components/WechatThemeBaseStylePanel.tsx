/**
 * [INPUT]: 依赖 React 运行时、lucide-react、shadcn/ui 基础控件、发布模块
 * [OUTPUT]: 对外提供 WechatThemeBaseStylePanel
 * [POS]: 发布 feature 的界面组合单元，连接 发布 状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useEffect, useId, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import type { WechatThemeBaseStyleChange } from "@/features/publishing/model/wechatThemeBaseStyle";
import { isWechatThemeColor, wechatThemeColorToPickerValue } from "@/features/publishing/model/wechatThemeModel";
import type { WechatThemeBaseStyle } from "@/features/publishing/model/wechatThemes";

interface WechatThemeBaseStylePanelProps {
  baseStyle: WechatThemeBaseStyle;
  disabled?: boolean;
  onChange: (change: WechatThemeBaseStyleChange, commit: boolean) => void;
}

export function WechatThemeBaseStylePanel({ baseStyle, disabled, onChange }: WechatThemeBaseStylePanelProps) {
  function updateTypography(key: keyof WechatThemeBaseStyle["typography"], value: number, commit: boolean) {
    onChange({ group: "typography", key, value }, commit);
  }

  function updateColor(key: keyof WechatThemeBaseStyle["colors"], value: string, commit: boolean) {
    onChange({ group: "colors", key, value }, commit);
  }

  function updateLayout(key: keyof WechatThemeBaseStyle["layout"], value: number, commit: boolean) {
    onChange({ group: "layout", key, value }, commit);
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
      <StyleSection title="字体">
        <NumberControl
          label="文章标题"
          value={baseStyle.typography.articleTitleSize}
          min={18}
          max={48}
          suffix="px"
          disabled={disabled}
          onChange={(value, commit) => updateTypography("articleTitleSize", value, commit)}
        />
        <NumberControl
          label="H2"
          value={baseStyle.typography.h2Size}
          min={16}
          max={36}
          suffix="px"
          disabled={disabled}
          onChange={(value, commit) => updateTypography("h2Size", value, commit)}
        />
        <NumberControl
          label="H3"
          value={baseStyle.typography.h3Size}
          min={14}
          max={30}
          suffix="px"
          disabled={disabled}
          onChange={(value, commit) => updateTypography("h3Size", value, commit)}
        />
        <NumberControl
          label="H4"
          value={baseStyle.typography.h4Size}
          min={12}
          max={26}
          suffix="px"
          disabled={disabled}
          onChange={(value, commit) => updateTypography("h4Size", value, commit)}
        />
        <NumberControl
          label="正文"
          value={baseStyle.typography.bodySize}
          min={12}
          max={24}
          suffix="px"
          disabled={disabled}
          onChange={(value, commit) => updateTypography("bodySize", value, commit)}
        />
        <NumberControl
          label="正文行高"
          value={baseStyle.typography.bodyLineHeight}
          min={1.2}
          max={2.6}
          step={0.05}
          disabled={disabled}
          onChange={(value, commit) => updateTypography("bodyLineHeight", value, commit)}
        />
        <NumberControl
          label="段落间距"
          value={baseStyle.typography.paragraphSpacing}
          min={0}
          max={40}
          suffix="px"
          disabled={disabled}
          onChange={(value, commit) => updateTypography("paragraphSpacing", value, commit)}
        />
      </StyleSection>

      <StyleSection title="颜色">
        <ColorControl
          label="主题色"
          value={baseStyle.colors.accent}
          disabled={disabled}
          onChange={(value, commit) => updateColor("accent", value, commit)}
        />
        <ColorControl
          label="页面背景"
          value={baseStyle.colors.pageBackground}
          disabled={disabled}
          onChange={(value, commit) => updateColor("pageBackground", value, commit)}
        />
        <ColorControl
          label="标题颜色"
          value={baseStyle.colors.titleText}
          disabled={disabled}
          onChange={(value, commit) => updateColor("titleText", value, commit)}
        />
        <ColorControl
          label="正文颜色"
          value={baseStyle.colors.bodyText}
          disabled={disabled}
          onChange={(value, commit) => updateColor("bodyText", value, commit)}
        />
        <ColorControl
          label="加粗颜色"
          value={baseStyle.colors.emphasisText}
          disabled={disabled}
          onChange={(value, commit) => updateColor("emphasisText", value, commit)}
        />
        <ColorControl
          label="链接颜色"
          value={baseStyle.colors.linkText}
          disabled={disabled}
          onChange={(value, commit) => updateColor("linkText", value, commit)}
        />
        <ColorControl
          label="标记颜色"
          value={baseStyle.colors.markColor}
          disabled={disabled}
          onChange={(value, commit) => updateColor("markColor", value, commit)}
        />
      </StyleSection>

      <StyleSection title="版式">
        <NumberControl
          label="内容左右留白"
          value={baseStyle.layout.contentPadding}
          min={0}
          max={48}
          suffix="px"
          disabled={disabled}
          onChange={(value, commit) => updateLayout("contentPadding", value, commit)}
        />
        <NumberControl
          label="章节间距"
          value={baseStyle.layout.sectionSpacing}
          min={12}
          max={72}
          suffix="px"
          disabled={disabled}
          onChange={(value, commit) => updateLayout("sectionSpacing", value, commit)}
        />
        <NumberControl
          label="圆角大小"
          value={baseStyle.layout.radius}
          min={0}
          max={40}
          suffix="px"
          disabled={disabled}
          onChange={(value, commit) => updateLayout("radius", value, commit)}
        />
        <NumberControl
          label="图片圆角"
          value={baseStyle.layout.imageRadius}
          min={0}
          max={40}
          suffix="px"
          disabled={disabled}
          onChange={(value, commit) => updateLayout("imageRadius", value, commit)}
        />
        <SliderControl
          label="阴影强度"
          value={baseStyle.layout.shadowStrength}
          min={0}
          max={2}
          step={0.05}
          disabled={disabled}
          onChange={(value, commit) => updateLayout("shadowStrength", value, commit)}
        />
      </StyleSection>
    </div>
  );
}

function StyleSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <h2 className="mb-1.5 px-1 text-[11px] font-medium tracking-wide text-muted-foreground">{title}</h2>
      <div className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border bg-background">{children}</div>
    </section>
  );
}

interface NumberControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  disabled?: boolean;
  onChange: (value: number, commit: boolean) => void;
}

function NumberControl({ label, value, min, max, step = 1, suffix, disabled, onChange }: NumberControlProps) {
  const inputId = useId();
  const [draft, setDraft] = useState(() => formatNumber(value));
  useEffect(() => setDraft(formatNumber(value)), [value]);

  function commitDraft() {
    const parsed = Number(draft);
    if (!draft.trim() || !Number.isFinite(parsed)) {
      setDraft(formatNumber(value));
      return;
    }
    const next = normalizeNumber(parsed, min, max, step);
    setDraft(formatNumber(next));
    onChange(next, true);
  }

  function stepBy(direction: -1 | 1) {
    const next = normalizeNumber(value + direction * step, min, max, step);
    setDraft(formatNumber(next));
    onChange(next, true);
  }

  return (
    <div className="flex min-h-11 items-center justify-between gap-3 px-3 py-2">
      <label htmlFor={inputId} className="min-w-0 whitespace-nowrap text-xs">
        {label}
      </label>
      <div
        className="flex h-7 w-[136px] shrink-0 items-center overflow-hidden rounded-lg border border-input bg-background transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50"
        title={`范围 ${formatNumber(min)}–${formatNumber(max)}${suffix ?? ""}`}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="size-7 rounded-none border-r border-border/70 text-muted-foreground"
          disabled={disabled || value <= min}
          aria-label={`减小${label}`}
          onClick={() => stepBy(-1)}
        >
          <Minus />
        </Button>
        <Input
          id={inputId}
          type="text"
          inputMode="decimal"
          value={draft}
          disabled={disabled}
          aria-label={label}
          className="h-7 min-w-0 flex-1 rounded-none border-0 bg-transparent px-1 text-center text-xs tabular-nums shadow-none focus-visible:ring-0 dark:bg-transparent"
          onChange={(event) => {
            const nextDraft = event.target.value;
            const parsed = Number(nextDraft);
            setDraft(nextDraft);
            if (nextDraft.trim() && Number.isFinite(parsed) && parsed >= min && parsed <= max) onChange(parsed, false);
          }}
          onBlur={commitDraft}
          onKeyDown={(event) => {
            if (event.key === "ArrowUp" || event.key === "ArrowDown") {
              event.preventDefault();
              stepBy(event.key === "ArrowUp" ? 1 : -1);
            } else if (event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
            } else if (event.key === "Escape") {
              setDraft(formatNumber(value));
              event.currentTarget.blur();
            }
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="size-7 rounded-none border-l border-border/70 text-muted-foreground"
          disabled={disabled || value >= max}
          aria-label={`增大${label}`}
          onClick={() => stepBy(1)}
        >
          <Plus />
        </Button>
      </div>
    </div>
  );
}

function SliderControl({ label, value, min, max, step = 1, disabled, onChange }: NumberControlProps) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 px-3 py-2">
      <span className="min-w-0 text-xs">{label}</span>
      <div className="flex w-[136px] shrink-0 items-center gap-2">
        <Slider
          value={[value]}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          aria-label={label}
          onValueChange={([next]) => onChange(next, false)}
          onValueCommit={([next]) => onChange(next, true)}
        />
        <output className="w-6 text-right text-[10px] tabular-nums text-muted-foreground">{formatNumber(value)}</output>
      </div>
    </div>
  );
}

interface ColorControlProps {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string, commit: boolean) => void;
}

function ColorControl({ label, value, disabled, onChange }: ColorControlProps) {
  const inputId = useId();
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const pickerValue = wechatThemeColorToPickerValue(value);

  function commit() {
    const next = draft.trim();
    if (isWechatThemeColor(next)) onChange(next, true);
    else setDraft(value);
  }

  return (
    <div className="flex min-h-11 items-center justify-between gap-3 px-3 py-2">
      <label htmlFor={inputId} className="min-w-0 whitespace-nowrap text-xs">
        {label}
      </label>
      <span className="flex w-[174px] shrink-0">
        <Input
          id={inputId}
          type="color"
          value={pickerValue}
          disabled={disabled}
          aria-label={`${label}取色器`}
          className="size-7 shrink-0 cursor-pointer rounded-r-none p-1"
          onInput={(event) => {
            const next = event.currentTarget.value;
            setDraft(next);
            onChange(next, false);
          }}
          onChange={(event) => onChange(event.currentTarget.value, true)}
        />
        <Input
          value={draft}
          disabled={disabled}
          aria-label={label}
          className="h-7 rounded-l-none border-l-0 px-1 font-mono text-[8.5px] uppercase"
          onChange={(event) => {
            const next = event.target.value;
            setDraft(next);
            if (isWechatThemeColor(next.trim())) onChange(next.trim(), false);
          }}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
        />
      </span>
    </div>
  );
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function normalizeNumber(value: number, min: number, max: number, step: number): number {
  const clamped = Math.min(max, Math.max(min, value));
  const precision = Math.max(decimalPlaces(min), decimalPlaces(step));
  const stepped = min + Math.round((clamped - min) / step) * step;
  return Number(Math.min(max, Math.max(min, stepped)).toFixed(precision));
}

function decimalPlaces(value: number): number {
  const decimal = String(value).split(".")[1];
  return decimal?.length ?? 0;
}
