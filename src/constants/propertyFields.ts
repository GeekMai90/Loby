import type { PropertyFieldType } from "../types";

export const FIELD_TYPES: Array<{ value: PropertyFieldType; label: string }> = [
  { value: "text", label: "文本" },
  { value: "number", label: "数字" },
  { value: "checkbox", label: "Checkbox" },
  { value: "date", label: "日期" },
  { value: "url", label: "URL" },
  { value: "select", label: "单选" },
  { value: "multiSelect", label: "多选" },
  { value: "tags", label: "标签" },
];

export function fieldTypeLabel(type: PropertyFieldType) {
  return FIELD_TYPES.find((item) => item.value === type)?.label ?? type;
}
