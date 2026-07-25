/**
 * [INPUT]: 依赖 lucide-react、shared 公共契约
 * [OUTPUT]: 对外提供 DocumentPropertyTypeIcon
 * [POS]: 写作库 feature 的界面组合单元，连接 写作库 状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { CalendarDays, CheckSquare2, Hash, Link2, List, ListChecks, Tags, Type } from "lucide-react";
import type { PropertyFieldType } from "@/shared/types";

export function DocumentPropertyTypeIcon({ type }: { type: PropertyFieldType }) {
  if (type === "number") return <Hash size={15} />;
  if (type === "checkbox") return <CheckSquare2 size={15} />;
  if (type === "date") return <CalendarDays size={15} />;
  if (type === "url") return <Link2 size={15} />;
  if (type === "select") return <List size={15} />;
  if (type === "multiSelect") return <ListChecks size={15} />;
  if (type === "tags") return <Tags size={15} />;
  return <Type size={15} />;
}
