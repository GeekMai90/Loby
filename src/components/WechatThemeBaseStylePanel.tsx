import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import type { WechatThemeBaseStyleChange } from "../lib/publishing/wechatThemeBaseStyle";
import { isWechatThemeColor, wechatThemeColorToPickerValue } from "../lib/publishing/wechatThemeModel";
import type { WechatThemeBaseStyle } from "../lib/publishing/wechatThemes";

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
      <p className="mb-4 text-[11px] leading-4 text-muted-foreground">调整会立即反映在预览中。修改内置主题时会自动创建个人副本。</p>
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
        <NumberControl
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
      <h2 className="mb-2 text-[11px] font-medium tracking-wide text-muted-foreground">{title}</h2>
      <div className="space-y-3 rounded-xl border border-border bg-background p-3">{children}</div>
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
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between gap-2 text-xs">
        <span>{label}</span>
        <span className="text-[10px] tabular-nums text-muted-foreground">
          {formatNumber(value)}
          {suffix}
        </span>
      </span>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onValueChange={([next]) => onChange(next, false)}
        onValueCommit={([next]) => onChange(next, true)}
      />
    </label>
  );
}

interface ColorControlProps {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string, commit: boolean) => void;
}

function ColorControl({ label, value, disabled, onChange }: ColorControlProps) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const pickerValue = wechatThemeColorToPickerValue(value);

  function commit() {
    const next = draft.trim();
    if (isWechatThemeColor(next)) onChange(next, true);
    else setDraft(value);
  }

  return (
    <label className="block">
      <span className="mb-1.5 block text-xs">{label}</span>
      <span className="flex gap-1.5">
        <Input
          type="color"
          value={pickerValue}
          disabled={disabled}
          aria-label={`${label}取色器`}
          className="w-9 shrink-0 cursor-pointer px-1"
          onInput={(event) => {
            const next = event.currentTarget.value;
            setDraft(next);
            onChange(next, false);
          }}
          onBlur={commit}
        />
        <Input
          value={draft}
          disabled={disabled}
          aria-label={label}
          className="font-mono text-[11px]"
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
    </label>
  );
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}
