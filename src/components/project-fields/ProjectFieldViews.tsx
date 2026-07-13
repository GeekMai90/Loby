import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  CheckSquare2,
  Hash,
  Link2,
  List,
  ListChecks,
  LockKeyhole,
  Pencil,
  Plus,
  Tags,
  Trash2,
  Type,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Toggle } from "@/components/ui/toggle";
import { createPropertyOption } from "../../lib/documentProperties";
import { FIELD_TYPES, fieldTypeLabel } from "../../constants/propertyFields";
import type { MetadataValue, ProjectPropertyDefinition, PropertyFieldType, PropertyOption } from "../../types";

export function FieldListScreen({
  definitions,
  onEdit,
  onRemove,
  onAdd,
}: {
  definitions: ProjectPropertyDefinition[];
  onEdit: (definition: ProjectPropertyDefinition) => void;
  onRemove: (definition: ProjectPropertyDefinition) => void;
  onAdd: () => void;
}) {
  return (
    <div className="mx-auto w-[min(620px,calc(100%-48px))] pt-7 pb-9 max-[720px]:w-[calc(100%-32px)]">
      <div className="mb-3.75 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-[15px] font-semibold">全部字段</h3>
          <small className="text-[11px] text-muted-foreground">{definitions.length} 个</small>
        </div>
        <Button type="button" onClick={onAdd}>
          <Plus /> 新增字段
        </Button>
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {definitions.map((definition) => (
          <div
            key={definition.id}
            className="group flex min-h-14.5 items-center gap-2.75 border-b border-border px-2.5 pl-3.5 last:border-b-0 hover:bg-accent"
          >
            <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              {fieldTypeIcon(definition.type)}
            </span>
            <span className="grid min-w-0 flex-1 gap-0.75">
              <strong className="truncate text-[13px] font-semibold">{definition.label}</strong>
              <small className="truncate text-[11px] text-muted-foreground">
                {fieldTypeLabel(definition.type)} · {definition.key}
              </small>
            </span>
            {definition.locked && (
              <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                <LockKeyhole size={11} /> 系统
              </span>
            )}
            <div className="flex shrink-0 gap-0.5 opacity-60 group-hover:opacity-100 focus-within:opacity-100">
              <Button type="button" variant="ghost" size="icon-sm" title="编辑字段" onClick={() => onEdit(definition)}>
                <Pencil />
              </Button>
              {!definition.locked && (
                <Button type="button" variant="destructive" size="icon-sm" title="删除字段" onClick={() => onRemove(definition)}>
                  <Trash2 />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FieldDefinitionEditor({
  definition,
  index,
  fieldCount,
  onUpdate,
  onMove,
  onRemove,
  onChangeType,
  onRemoveOption,
  onMoveOption,
  onApplyDefault,
  defaultApplicationPending,
  defaultApplicationNotice,
}: {
  definition: ProjectPropertyDefinition;
  index: number;
  fieldCount: number;
  onUpdate: (updater: (definition: ProjectPropertyDefinition) => ProjectPropertyDefinition) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  onChangeType: (type: PropertyFieldType) => void;
  onRemoveOption: (option: PropertyOption) => void;
  onMoveOption: (optionId: string, direction: -1 | 1) => void;
  onApplyDefault: () => void;
  defaultApplicationPending: boolean;
  defaultApplicationNotice: string;
}) {
  return (
    <div className="mx-auto w-[min(620px,calc(100%-48px))] pt-6.5 pb-9.5 max-[720px]:w-[calc(100%-32px)]">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2.75">
          <span className="inline-flex size-8.5 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
            {fieldTypeIcon(definition.type)}
          </span>
          <div>
            <h3 className="max-w-110 truncate text-[15px] font-semibold">{definition.label}</h3>
            <small className="mt-0.75 block text-[11px] text-muted-foreground">{definition.locked ? "系统字段" : "自定义字段"}</small>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button type="button" variant="ghost" size="icon-sm" title="上移" disabled={index === 0} onClick={() => onMove(-1)}>
            <ArrowUp />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" title="下移" disabled={index === fieldCount - 1} onClick={() => onMove(1)}>
            <ArrowDown />
          </Button>
          {!definition.locked && (
            <Button type="button" variant="destructive" size="icon-sm" title="移除字段" onClick={onRemove}>
              <Trash2 />
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4.5 [&_label]:grid [&_label]:gap-1.5 [&_label]:text-[11px] [&_label]:font-semibold [&_label]:text-muted-foreground">
        <div className="grid grid-cols-[minmax(0,1fr)_190px] gap-3 max-[720px]:grid-cols-1">
          <label>
            <span>字段名称</span>
            <Input
              value={definition.label}
              disabled={definition.locked}
              onChange={(event) => onUpdate((current) => ({ ...current, label: event.target.value }))}
            />
          </label>
          <label>
            <span>字段类型</span>
            <Select
              value={definition.type}
              disabled={definition.locked}
              onValueChange={(value) => onChangeType(value as PropertyFieldType)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        </div>

        <label>
          <span>说明</span>
          <Input
            value={definition.description ?? ""}
            disabled={definition.locked}
            placeholder="可选"
            onChange={(event) => onUpdate((current) => ({ ...current, description: event.target.value }))}
          />
        </label>

        <label className="max-w-75.5 max-[720px]:max-w-none">
          <span>YAML 键</span>
          <Input value={definition.key} disabled />
        </label>

        {(definition.type === "select" || definition.type === "multiSelect") && (
          <div className="grid gap-1.5 border-t border-border pt-4.5 text-[11px] font-semibold text-muted-foreground">
            <div className="flex items-center gap-1.75">
              <span className="text-xs font-semibold text-foreground">预设选项</span>
              <small className="text-[10px] text-muted-foreground">{definition.options?.length ?? 0}</small>
            </div>
            <div className="grid gap-1.75">
              {(definition.options ?? []).map((option, optionIndex) => (
                <div key={option.id} className="flex items-center gap-2">
                  <input
                    className="size-5.5 overflow-hidden rounded-full border-0 bg-transparent p-0"
                    type="color"
                    value={option.color || "#8e8e93"}
                    aria-label={`${option.label}颜色`}
                    disabled={definition.locked}
                    onChange={(event) =>
                      onUpdate((current) => ({
                        ...current,
                        options: (current.options ?? []).map((item) =>
                          item.id === option.id ? { ...item, color: event.target.value } : item,
                        ),
                      }))
                    }
                  />
                  <Input
                    className="flex-1"
                    value={option.label}
                    disabled={definition.locked}
                    onChange={(event) =>
                      onUpdate((current) => ({
                        ...current,
                        options: (current.options ?? []).map((item) =>
                          item.id === option.id ? { ...item, label: event.target.value } : item,
                        ),
                      }))
                    }
                  />
                  {!definition.locked && (
                    <div className="flex shrink-0 gap-0.25">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        title="上移选项"
                        disabled={optionIndex === 0}
                        onClick={() => onMoveOption(option.id, -1)}
                      >
                        <ArrowUp />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        title="下移选项"
                        disabled={optionIndex === (definition.options?.length ?? 0) - 1}
                        onClick={() => onMoveOption(option.id, 1)}
                      >
                        <ArrowDown />
                      </Button>
                      <Button type="button" variant="ghost" size="icon-xs" title="删除选项" onClick={() => onRemoveOption(option)}>
                        <X />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {!definition.locked && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-fit"
                onClick={() =>
                  onUpdate((current) => ({
                    ...current,
                    options: [...(current.options ?? []), createPropertyOption("", current.options?.length ?? 0)],
                  }))
                }
              >
                <Plus /> 添加选项
              </Button>
            )}
          </div>
        )}

        <div className="grid grid-cols-[minmax(180px,1fr)_auto] items-end gap-4.5 border-t border-border pt-4.5 max-[720px]:grid-cols-1 [&>label:first-child]:max-w-70 max-[720px]:[&>label:first-child]:max-w-none">
          <DefaultValueControl definition={definition} onChange={(value) => onUpdate((current) => ({ ...current, defaultValue: value }))} />
          <label className="flex! items-center justify-between gap-3.5! whitespace-nowrap">
            <span>空值时显示</span>
            <Switch
              checked={definition.showWhenEmpty ?? true}
              onCheckedChange={(checked) => onUpdate((current) => ({ ...current, showWhenEmpty: checked }))}
            />
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="col-span-full w-fit"
            disabled={defaultApplicationPending}
            onClick={onApplyDefault}
          >
            {defaultApplicationPending ? "保存后将应用到已有文稿" : "应用到已有空值文稿"}
          </Button>
          {defaultApplicationNotice && (
            <p className="col-span-full -mt-2 text-[11px] leading-4.5 text-muted-foreground">{defaultApplicationNotice}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function NewFieldEditor({
  name,
  type,
  onNameChange,
  onTypeChange,
  onAdd,
}: {
  name: string;
  type: PropertyFieldType;
  onNameChange: (name: string) => void;
  onTypeChange: (type: PropertyFieldType) => void;
  onAdd: () => void;
}) {
  return (
    <div className="mx-auto w-[min(620px,calc(100%-48px))] pt-6.5 pb-9.5 max-[720px]:w-[calc(100%-32px)]">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2.75">
          <span className="inline-flex size-8.5 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
            <Plus size={17} />
          </span>
          <div>
            <h3 className="text-[15px] font-semibold">新增字段</h3>
            <small className="mt-0.75 block text-[11px] text-muted-foreground">自定义字段</small>
          </div>
        </div>
      </div>
      <div className="grid max-w-140 gap-4.5 [&_label]:grid [&_label]:gap-1.5 [&_label]:text-[11px] [&_label]:font-semibold [&_label]:text-muted-foreground">
        <label>
          <span>字段名称</span>
          <Input value={name} placeholder="例如：公众号发布" autoFocus onChange={(event) => onNameChange(event.target.value)} />
        </label>
        <div className="grid gap-1.5 text-[11px] font-semibold text-muted-foreground">
          <span>字段类型</span>
          <div className="grid grid-cols-4 gap-2 max-[720px]:grid-cols-2">
            {FIELD_TYPES.map((fieldType) => (
              <Button
                key={fieldType.value}
                type="button"
                variant={type === fieldType.value ? "secondary" : "outline"}
                className="h-14 min-w-0 justify-start px-3"
                onClick={() => onTypeChange(fieldType.value)}
              >
                {fieldTypeIcon(fieldType.value)}
                <span className="truncate">{fieldType.label}</span>
              </Button>
            ))}
          </div>
        </div>
        <Button type="button" className="w-fit" disabled={!name.trim()} onClick={onAdd}>
          <Plus /> 添加字段
        </Button>
      </div>
    </div>
  );
}

function fieldTypeIcon(type: PropertyFieldType) {
  if (type === "number") return <Hash size={15} />;
  if (type === "checkbox") return <CheckSquare2 size={15} />;
  if (type === "date") return <CalendarDays size={15} />;
  if (type === "url") return <Link2 size={15} />;
  if (type === "select") return <List size={15} />;
  if (type === "multiSelect") return <ListChecks size={15} />;
  if (type === "tags") return <Tags size={15} />;
  return <Type size={15} />;
}

function DefaultValueControl({
  definition,
  onChange,
}: {
  definition: ProjectPropertyDefinition;
  onChange: (value: MetadataValue | undefined) => void;
}) {
  const value = definition.defaultValue;
  if (definition.type === "checkbox") {
    return (
      <label className="flex! items-center justify-between gap-3.5! whitespace-nowrap">
        <Checkbox checked={value === true} onCheckedChange={(checked) => onChange(checked === true)} />
        新文稿默认勾选
      </label>
    );
  }
  if (definition.type === "select") {
    return (
      <label>
        <span>默认值</span>
        <Select
          value={typeof value === "string" && value ? value : "__none__"}
          onValueChange={(nextValue) => onChange(nextValue === "__none__" ? undefined : nextValue)}
        >
          <SelectTrigger className="w-full">
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
      <label>
        <span>默认值</span>
        <Input
          type="number"
          value={typeof value === "number" ? value : ""}
          onChange={(event) => onChange(event.target.value === "" ? undefined : Number(event.target.value))}
        />
      </label>
    );
  }
  if (definition.type === "date") {
    return (
      <label>
        <span>默认值</span>
        <Input type="date" value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value || undefined)} />
      </label>
    );
  }
  if (definition.type === "multiSelect") {
    const selected = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
    return (
      <div className="grid gap-1.75 text-[11px] font-semibold text-muted-foreground">
        <span>默认值</span>
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
      <label>
        <span>默认标签</span>
        <Input
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
    <label>
      <span>默认值</span>
      <Input value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value || undefined)} />
    </label>
  );
}
