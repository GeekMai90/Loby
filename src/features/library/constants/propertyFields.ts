/**
 * [INPUT]: 依赖 shared 公共契约
 * [OUTPUT]: 对外提供 FIELD_TYPES、CUSTOM_FIELD_TYPES、fieldTypeLabel
 * [POS]: 写作库 feature 的稳定配置边界，集中 写作库 选项、默认值与持久化标识
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { PropertyFieldType } from "@/shared/types";

export const FIELD_TYPES: Array<{ value: PropertyFieldType; label: string; description: string }> = [
  { value: "text", label: "文本", description: "记录名称、备注等简短内容" },
  { value: "number", label: "数字", description: "记录字数、数量等数值" },
  { value: "checkbox", label: "复选框", description: "标记完成、发布等两种状态" },
  { value: "date", label: "日期", description: "记录发布或截止日期" },
  { value: "url", label: "URL", description: "保存网页或资料链接" },
  { value: "select", label: "单选", description: "从一组选项中选择一项" },
  { value: "multiSelect", label: "多选", description: "从一组选项中选择多项" },
  { value: "tags", label: "标签", description: "使用文稿标签整理内容" },
];

export const CUSTOM_FIELD_TYPES = FIELD_TYPES.filter((item) => item.value !== "tags");

export function fieldTypeLabel(type: PropertyFieldType) {
  return FIELD_TYPES.find((item) => item.value === type)?.label ?? type;
}
