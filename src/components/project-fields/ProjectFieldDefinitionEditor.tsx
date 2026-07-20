import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { FIELD_TYPES } from "../../constants/propertyFields";
import { createPropertyOption } from "../../lib/documentProperties";
import type { ProjectPropertyDefinition, PropertyFieldType, PropertyOption } from "../../types";
import { ProjectFieldDefaultValueControl } from "./ProjectFieldDefaultValueControl";
import { ProjectFieldTypeIcon } from "./ProjectFieldTypeIcon";

export function FieldDefinitionEditor({
  definition,
  index,
  minimumIndex,
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
  minimumIndex: number;
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
            <ProjectFieldTypeIcon type={definition.type} />
          </span>
          <div>
            <h3 className="max-w-110 truncate text-[15px] font-semibold">{definition.label}</h3>
            <small className="mt-0.75 block text-[11px] text-muted-foreground">{definition.locked ? "系统属性" : "自定义属性"}</small>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {!definition.locked && (
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
          )}
          {!definition.locked && (
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
          )}
        </div>
      </div>

      <div className="grid gap-4.5 [&_label]:grid [&_label]:gap-1.5 [&_label]:text-[11px] [&_label]:font-semibold [&_label]:text-muted-foreground">
        <div className="grid grid-cols-[minmax(0,1fr)_190px] gap-3 max-[720px]:grid-cols-1">
          <label>
            <span>属性名称</span>
            <Input
              value={definition.label}
              disabled={definition.locked}
              onChange={(event) => onUpdate((current) => ({ ...current, label: event.target.value }))}
            />
          </label>
          <label>
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
          <ProjectFieldDefaultValueControl
            definition={definition}
            onChange={(value) => onUpdate((current) => ({ ...current, defaultValue: value }))}
          />
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
