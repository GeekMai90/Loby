import { CalendarDays } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import type { MetadataValue, ProjectPropertyDefinition } from "../../types";

const PropertyDateCalendar = lazy(() => import("../PropertyDateCalendar").then((module) => ({ default: module.PropertyDateCalendar })));

export function ProjectFieldDefaultValueControl({
  definition,
  onChange,
}: {
  definition: ProjectPropertyDefinition;
  onChange: (value: MetadataValue | undefined) => void;
}) {
  const value = definition.defaultValue;
  if (definition.type === "checkbox") {
    return (
      <div className="flex items-center justify-between gap-4">
        <FieldDefaultLabel description="新建文稿时是否自动勾选" />
        <Checkbox aria-label="新文稿默认勾选" checked={value === true} onCheckedChange={(checked) => onChange(checked === true)} />
      </div>
    );
  }
  if (definition.type === "select") {
    return (
      <label className="grid grid-cols-[124px_minmax(0,1fr)] items-center gap-4 max-[560px]:grid-cols-1 max-[560px]:gap-1.5">
        <FieldDefaultLabel description="新建文稿时自动填入" />
        <Select
          value={typeof value === "string" && value ? value : "__none__"}
          onValueChange={(nextValue) => onChange(nextValue === "__none__" ? undefined : nextValue)}
        >
          <SelectTrigger className="w-full max-w-70">
            <SelectValue placeholder="无" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">无</SelectItem>
            {(definition.options ?? []).map((option) => (
              <SelectItem key={option.id} value={option.label}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
    );
  }
  if (definition.type === "number") {
    return (
      <label className="grid grid-cols-[124px_minmax(0,1fr)] items-center gap-4 max-[560px]:grid-cols-1 max-[560px]:gap-1.5">
        <FieldDefaultLabel description="新建文稿时自动填入" />
        <Input
          className="max-w-70"
          type="number"
          value={typeof value === "number" ? value : ""}
          onChange={(event) => onChange(event.target.value === "" ? undefined : Number(event.target.value))}
        />
      </label>
    );
  }
  if (definition.type === "date") {
    return (
      <div className="grid grid-cols-[124px_minmax(0,1fr)] items-center gap-4 max-[560px]:grid-cols-1 max-[560px]:gap-1.5">
        <FieldDefaultLabel description="新建文稿时自动填入" />
        <DateDefaultValueControl value={typeof value === "string" ? value : ""} onChange={onChange} />
      </div>
    );
  }
  if (definition.type === "multiSelect") {
    const selected = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
    return (
      <div className="grid grid-cols-[124px_minmax(0,1fr)] items-start gap-4 max-[560px]:grid-cols-1 max-[560px]:gap-1.5">
        <FieldDefaultLabel description="新建文稿时自动选中" />
        <div className="flex flex-wrap gap-1.5">
          {(definition.options ?? []).map((option) => {
            const active = selected.includes(option.label);
            return (
              <Toggle
                key={option.id}
                pressed={active}
                variant="outline"
                size="sm"
                onClick={() => onChange(active ? selected.filter((item) => item !== option.label) : [...selected, option.label])}
              >
                <span className="size-2 rounded-full" style={{ backgroundColor: option.color }} />
                {option.label}
              </Toggle>
            );
          })}
        </div>
      </div>
    );
  }
  if (definition.type === "tags") {
    const tags = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
    return (
      <label className="grid grid-cols-[124px_minmax(0,1fr)] items-center gap-4 max-[560px]:grid-cols-1 max-[560px]:gap-1.5">
        <FieldDefaultLabel label="默认标签" description="新建文稿时自动填入" />
        <Input
          className="max-w-70"
          value={tags.join(", ")}
          placeholder="使用逗号分隔"
          onChange={(event) =>
            onChange(
              Array.from(
                new Set(
                  event.target.value
                    .split(/[,，]/)
                    .map((tag) => tag.trim())
                    .filter(Boolean),
                ),
              ),
            )
          }
        />
      </label>
    );
  }
  return (
    <label className="grid grid-cols-[124px_minmax(0,1fr)] items-center gap-4 max-[560px]:grid-cols-1 max-[560px]:gap-1.5">
      <FieldDefaultLabel description="新建文稿时自动填入" />
      <Input
        className="max-w-70"
        type={definition.type === "url" ? "url" : "text"}
        placeholder={definition.type === "url" ? "https://" : "留空则不设置"}
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value || undefined)}
      />
    </label>
  );
}

function DateDefaultValueControl({ value, onChange }: { value: string; onChange: (value: MetadataValue | undefined) => void }) {
  const [open, setOpen] = useState(false);
  const selectedDate = parsePropertyDate(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="w-full max-w-70 justify-between font-normal">
          <span>{selectedDate ? formatPropertyDateLabel(selectedDate) : "选择日期"}</span>
          <CalendarDays className="text-muted-foreground" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        variant="solid"
        align="start"
        sideOffset={5}
        className="w-auto p-1.5"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <Suspense
          fallback={<div className="flex h-[228px] w-[212px] items-center justify-center text-xs text-muted-foreground">加载日历…</div>}
        >
          <PropertyDateCalendar
            selected={selectedDate}
            defaultMonth={selectedDate}
            onSelect={(nextDate) => {
              if (!nextDate) return;
              onChange(formatPropertyDateValue(nextDate));
              setOpen(false);
            }}
            className="bg-transparent p-1"
          />
        </Suspense>
        {selectedDate && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-1 w-full text-muted-foreground"
            onClick={() => {
              onChange(undefined);
              setOpen(false);
            }}
          >
            清除日期
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

function parsePropertyDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : undefined;
}

function formatPropertyDateLabel(date: Date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatPropertyDateValue(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function FieldDefaultLabel({ label = "默认值", description }: { label?: string; description: string }) {
  return (
    <span>
      <strong className="block text-[12px] font-semibold text-foreground">{label}</strong>
      <small className="mt-0.5 block text-[10px] font-normal text-muted-foreground">{description}</small>
    </span>
  );
}
