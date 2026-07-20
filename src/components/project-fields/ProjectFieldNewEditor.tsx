import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CUSTOM_FIELD_TYPES } from "../../constants/propertyFields";
import type { PropertyFieldType } from "../../types";
import { ProjectFieldTypeIcon } from "./ProjectFieldTypeIcon";

export function NewFieldEditor({
  name,
  type,
  onNameChange,
  onTypeChange,
}: {
  name: string;
  type: PropertyFieldType;
  onNameChange: (name: string) => void;
  onTypeChange: (type: PropertyFieldType) => void;
}) {
  return (
    <div className="mx-auto w-[min(620px,calc(100%-48px))] pt-5 pb-8 max-[720px]:w-[calc(100%-32px)]">
      <div className="mb-4.5">
        <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold text-primary">
          <span className="rounded-full bg-primary/10 px-2 py-0.5">第 1 步，共 2 步</span>
          <span className="text-muted-foreground">基本信息</span>
        </div>
        <h3 className="text-[20px] font-semibold tracking-tight">创建自定义属性</h3>
        <p className="mt-1.5 text-[13px] leading-5 text-muted-foreground">填写名称并选择类型，下一步再设置默认值和显示方式。</p>
      </div>

      <div className="grid gap-4.5 [&_label]:grid [&_label]:gap-2 [&_label]:text-[12px] [&_label]:font-semibold [&_label]:text-foreground">
        <label>
          <span>属性名称</span>
          <Input
            className="h-10 text-[14px]"
            value={name}
            placeholder="例如：公众号发布"
            autoFocus
            onChange={(event) => onNameChange(event.target.value)}
          />
        </label>
        <div className="grid gap-2">
          <span className="text-[12px] font-semibold text-foreground">属性类型</span>
          <div className="grid grid-cols-2 gap-2 max-[560px]:grid-cols-1">
            {CUSTOM_FIELD_TYPES.map((fieldType) => (
              <Button
                key={fieldType.value}
                type="button"
                variant="outline"
                aria-pressed={type === fieldType.value}
                className={`h-14 min-w-0 justify-start gap-3 rounded-xl px-3.5 text-left ${
                  type === fieldType.value
                    ? "border-primary/45 bg-primary/[0.06] text-foreground ring-1 ring-primary/15 hover:bg-primary/[0.08]"
                    : "bg-background hover:bg-muted/60"
                }`}
                onClick={() => onTypeChange(fieldType.value)}
              >
                <span
                  className={`grid size-8 shrink-0 place-items-center rounded-lg ${
                    type === fieldType.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  <ProjectFieldTypeIcon type={fieldType.value} />
                </span>
                <span className="min-w-0">
                  <strong className="block truncate text-[13px] font-semibold">{fieldType.label}</strong>
                  <small className="mt-0.5 block truncate text-[11px] font-normal text-muted-foreground">{fieldType.description}</small>
                </span>
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
