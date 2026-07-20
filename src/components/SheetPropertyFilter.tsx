import type { ProjectPropertyDefinition, PropertyFieldType } from "../types";
import { getDefaultPropertyFilterOperator, type DocumentPropertyFilter, type PropertyFilterOperator } from "../lib/documentProperties";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface SheetPropertyFilterProps {
  definitions: ProjectPropertyDefinition[];
  filter: DocumentPropertyFilter;
  onChange: (filter: DocumentPropertyFilter) => void;
}

const OPERATOR_LABELS: Record<PropertyFilterOperator, string> = {
  contains: "包含",
  equals: "等于",
  notEquals: "不等于",
  isEmpty: "为空",
  isNotEmpty: "不为空",
  greaterThan: "大于 / 晚于",
  lessThan: "小于 / 早于",
  between: "介于",
  isTrue: "已勾选",
  isFalse: "未勾选",
  containsAny: "包含任一",
  containsAll: "包含全部",
};

export function SheetPropertyFilter({ definitions, filter, onChange }: SheetPropertyFilterProps) {
  const definition = definitions.find((item) => item.key === filter.fieldKey);
  const operators = definition ? operatorsForType(definition.type) : [];
  const needsValue = definition && !["isEmpty", "isNotEmpty", "isTrue", "isFalse"].includes(filter.operator);

  function selectDefinition(fieldKey: string) {
    const nextDefinition = definitions.find((item) => item.key === fieldKey);
    onChange({
      fieldKey,
      operator: nextDefinition ? getDefaultPropertyFilterOperator(nextDefinition.type) : "contains",
      value: "",
      valueTo: "",
    });
  }

  return (
    <div className="grid gap-2">
      <Select value={filter.fieldKey || "__none__"} onValueChange={(value) => selectDefinition(value === "__none__" ? "" : value)}>
        <SelectTrigger className="w-full" aria-label="筛选属性">
          <SelectValue placeholder="选择属性" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">选择属性</SelectItem>
          {definitions.map((item) => (
            <SelectItem key={item.id} value={item.key}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {definition && (
        <Select
          value={filter.operator}
          onValueChange={(value) => onChange({ ...filter, operator: value as PropertyFilterOperator, value: "", valueTo: "" })}
        >
          <SelectTrigger className="w-full" aria-label="筛选条件">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {operators.map((operator) => (
              <SelectItem key={operator} value={operator}>
                {OPERATOR_LABELS[operator]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {definition && needsValue && <FilterValueControl definition={definition} filter={filter} onChange={onChange} />}
    </div>
  );
}

function FilterValueControl({
  definition,
  filter,
  onChange,
}: {
  definition: ProjectPropertyDefinition;
  filter: DocumentPropertyFilter;
  onChange: (filter: DocumentPropertyFilter) => void;
}) {
  if (definition.type === "select") {
    return (
      <Select
        value={filter.value || "__none__"}
        onValueChange={(value) => onChange({ ...filter, value: value === "__none__" ? "" : value })}
      >
        <SelectTrigger className="w-full" aria-label="筛选值">
          <SelectValue placeholder="选择选项" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">选择选项</SelectItem>
          {(definition.options ?? []).map((option) => (
            <SelectItem key={option.id} value={option.label}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  const inputType = definition.type === "date" ? "date" : definition.type === "number" ? "number" : "text";
  const placeholder =
    definition.type === "tags" || definition.type === "multiSelect"
      ? "多个值用逗号分隔"
      : definition.type === "number"
        ? "输入数字"
        : "输入筛选值";

  if (filter.operator === "between") {
    return (
      <div className="flex items-center gap-2">
        <Input
          type={inputType}
          aria-label="筛选起始值"
          value={filter.value}
          onChange={(event) => onChange({ ...filter, value: event.target.value })}
        />
        <span className="shrink-0 text-xs text-muted-foreground">至</span>
        <Input
          type={inputType}
          aria-label="筛选结束值"
          value={filter.valueTo ?? ""}
          onChange={(event) => onChange({ ...filter, valueTo: event.target.value })}
        />
      </div>
    );
  }

  return (
    <>
      <Input
        type={inputType}
        aria-label="筛选值"
        list={definition.type === "multiSelect" ? "property-filter-options" : undefined}
        placeholder={placeholder}
        value={filter.value}
        onChange={(event) => onChange({ ...filter, value: event.target.value })}
      />
      {definition.type === "multiSelect" && (
        <datalist id="property-filter-options">
          {(definition.options ?? []).map((option) => (
            <option key={option.id} value={option.label} />
          ))}
        </datalist>
      )}
    </>
  );
}

function operatorsForType(type: PropertyFieldType): PropertyFilterOperator[] {
  if (type === "checkbox") return ["isTrue", "isFalse", "isEmpty"];
  if (type === "select") return ["equals", "notEquals", "isEmpty", "isNotEmpty"];
  if (type === "multiSelect" || type === "tags") return ["containsAny", "containsAll", "isEmpty", "isNotEmpty"];
  if (type === "number" || type === "date") {
    return ["equals", "notEquals", "greaterThan", "lessThan", "between", "isEmpty", "isNotEmpty"];
  }
  return ["contains", "equals", "notEquals", "isEmpty", "isNotEmpty"];
}
