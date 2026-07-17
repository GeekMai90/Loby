import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FIELD_TYPES } from "../../constants/propertyFields";
import type { PropertyFieldType } from "../../types";
import { ProjectFieldTypeIcon } from "./ProjectFieldTypeIcon";

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
                <ProjectFieldTypeIcon type={fieldType.value} />
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
