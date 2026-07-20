import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CUSTOM_FIELD_TYPES, fieldTypeLabel } from "../../constants/propertyFields";
import { createPropertyOption } from "../../lib/documentProperties";
import type { ProjectPropertyDefinition, PropertyFieldType, PropertyOption } from "../../types";
import { ProjectFieldDefaultValueControl } from "./ProjectFieldDefaultValueControl";
import { ProjectFieldTypeIcon } from "./ProjectFieldTypeIcon";

export function FieldDefinitionEditor({
  definition,
  isNew = false,
  index,
  minimumIndex,
  fieldCount,
  onUpdate,
  onMove,
  onRemove,
  onChangeType,
  onRemoveOption,
  onMoveOption,
}: {
  definition: ProjectPropertyDefinition;
  isNew?: boolean;
  index: number;
  minimumIndex: number;
  fieldCount: number;
  onUpdate: (updater: (definition: ProjectPropertyDefinition) => ProjectPropertyDefinition) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  onChangeType: (type: PropertyFieldType) => void;
  onRemoveOption: (option: PropertyOption) => void;
  onMoveOption: (optionId: string, direction: -1 | 1) => void;
}) {
  return (
    <div className="mx-auto w-[calc(100%-48px)] pt-5 pb-8 max-[720px]:w-[calc(100%-32px)]">
      {isNew && (
        <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold text-primary">
          <span className="rounded-full bg-primary/10 px-2 py-0.5">第 2 步，共 2 步</span>
          <span className="text-muted-foreground">详细设置</span>
        </div>
      )}

      <div className="mb-3 flex items-center justify-between gap-4 rounded-2xl bg-muted/55 px-3.5 py-3">
        <div className="flex min-w-0 items-center gap-2.75">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ProjectFieldTypeIcon type={definition.type} />
          </span>
          <div>
            <h3 className="max-w-110 truncate text-[15px] font-semibold">{definition.label}</h3>
            <small className="mt-0.5 block text-[11px] text-muted-foreground">
              {fieldTypeLabel(definition.type)} · {definition.locked ? "系统属性" : "自定义属性"}
            </small>
          </div>
        </div>
        {!definition.locked && !isNew && (
          <div className="flex shrink-0 items-center gap-0.5">
            <>
              <Button type="button" variant="ghost" size="icon-sm" title="上移" disabled={index <= minimumIndex} onClick={() => onMove(-1)}>
                <ArrowUp />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                title="下移"
                disabled={index === fieldCount - 1}
                onClick={() => onMove(1)}
              >
                <ArrowDown />
              </Button>
            </>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              title="移除属性"
              onClick={onRemove}
            >
              <Trash2 />
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-3">
        <section className="rounded-2xl bg-muted/40 p-4">
          <h4 className="mb-3 text-[13px] font-semibold">基本设置</h4>
          <div className="grid gap-3.5">
            {!isNew && (
              <div className="grid grid-cols-[minmax(0,1fr)_190px] gap-3 max-[720px]:grid-cols-1">
                <label className="grid gap-1.5 text-[11px] font-semibold text-muted-foreground">
                  <span>属性名称</span>
                  <Input
                    value={definition.label}
                    disabled={definition.locked}
                    onChange={(event) => onUpdate((current) => ({ ...current, label: event.target.value }))}
                  />
                </label>
                <label className="grid gap-1.5 text-[11px] font-semibold text-muted-foreground">
                  <span>属性类型</span>
                  <Select
                    value={definition.type}
                    disabled={definition.locked}
                    onValueChange={(value) => onChangeType(value as PropertyFieldType)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CUSTOM_FIELD_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              </div>
            )}

            <label className="grid grid-cols-[124px_minmax(0,1fr)] items-center gap-4 max-[560px]:grid-cols-1 max-[560px]:gap-1.5">
              <span>
                <strong className="block text-[12px] font-semibold">说明</strong>
                <small className="mt-0.5 block text-[10px] font-normal text-muted-foreground">帮助理解这个属性</small>
              </span>
              <Input
                value={definition.description ?? ""}
                disabled={definition.locked}
                placeholder="可选"
                onChange={(event) => onUpdate((current) => ({ ...current, description: event.target.value }))}
              />
            </label>
          </div>
        </section>

        {(definition.type === "select" || definition.type === "multiSelect") && (
          <section className="rounded-2xl bg-muted/40 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h4 className="text-[13px] font-semibold">选项</h4>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {definition.type === "select" ? "用户只能选择其中一项" : "用户可以同时选择多项"}
                </p>
              </div>
              <span className="rounded-full bg-background px-2 py-0.5 text-[10px] text-muted-foreground shadow-sm">
                {definition.options?.length ?? 0} 项
              </span>
            </div>
            <div className="grid overflow-hidden rounded-xl bg-background px-2 shadow-sm ring-1 ring-foreground/6">
              {(definition.options ?? []).map((option, optionIndex) => (
                <div key={option.id} className="flex min-h-11 items-center gap-2 border-b border-border/60 px-1.5 last:border-b-0">
                  <input
                    className="size-6 shrink-0 cursor-pointer appearance-none overflow-hidden rounded-full border-0 bg-transparent p-0 shadow-[0_0_0_1px_color-mix(in_oklch,var(--border),transparent_15%)] [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0"
                    type="color"
                    value={option.color || "#8e8e93"}
                    aria-label={`${option.label}颜色`}
                    title="选择颜色"
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
                    className="h-8 flex-1 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
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
                    <div className="flex shrink-0 gap-0.25 text-muted-foreground">
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
                className="mt-2.5 -ml-2 w-fit text-muted-foreground"
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
          </section>
        )}

        <section className="rounded-2xl bg-muted/40 p-4">
          <h4 className="mb-1 text-[13px] font-semibold">默认值</h4>
          <div className="py-3">
            <ProjectFieldDefaultValueControl
              definition={definition}
              onChange={(value) => onUpdate((current) => ({ ...current, defaultValue: value }))}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
