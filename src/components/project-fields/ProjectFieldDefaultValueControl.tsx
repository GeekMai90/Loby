import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import type { MetadataValue, ProjectPropertyDefinition } from "../../types";

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
