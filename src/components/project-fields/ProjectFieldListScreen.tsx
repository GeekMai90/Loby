import { LockKeyhole, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fieldTypeLabel } from "../../constants/propertyFields";
import type { ProjectPropertyDefinition } from "../../types";
import { ProjectFieldTypeIcon } from "./ProjectFieldTypeIcon";

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
              <ProjectFieldTypeIcon type={definition.type} />
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
