import type { ProjectPropertyDefinition, PropertyFieldType } from "../types";
import { getDefaultPropertyFilterOperator, type DocumentPropertyFilter, type PropertyFilterOperator } from "../lib/documentProperties";

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
    <div className="sheet-property-filter">
      <select
        className="sheet-property-filter-field"
        aria-label="筛选字段"
        value={filter.fieldKey}
        onChange={(event) => selectDefinition(event.target.value)}
      >
        <option value="">选择属性</option>
        {definitions.map((item) => (
          <option key={item.id} value={item.key}>
            {item.label}
          </option>
        ))}
      </select>

      {definition && (
        <select
          aria-label="筛选条件"
          value={filter.operator}
          onChange={(event) => onChange({ ...filter, operator: event.target.value as PropertyFilterOperator, value: "", valueTo: "" })}
        >
          {operators.map((operator) => (
            <option key={operator} value={operator}>
              {OPERATOR_LABELS[operator]}
            </option>
          ))}
        </select>
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
      <select aria-label="筛选值" value={filter.value} onChange={(event) => onChange({ ...filter, value: event.target.value })}>
        <option value="">选择选项</option>
        {(definition.options ?? []).map((option) => (
          <option key={option.id} value={option.label}>
            {option.label}
          </option>
        ))}
      </select>
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
      <div className="sheet-property-filter-range">
        <input
          type={inputType}
          aria-label="筛选起始值"
          value={filter.value}
          onChange={(event) => onChange({ ...filter, value: event.target.value })}
        />
        <span>至</span>
        <input
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
      <input
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
