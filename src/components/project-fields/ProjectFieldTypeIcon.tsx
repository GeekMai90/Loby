import { CalendarDays, CheckSquare2, Hash, Link2, List, ListChecks, Tags, Type } from "lucide-react";
import type { PropertyFieldType } from "../../types";

export function ProjectFieldTypeIcon({ type }: { type: PropertyFieldType }) {
  if (type === "number") return <Hash size={15} />;
  if (type === "checkbox") return <CheckSquare2 size={15} />;
  if (type === "date") return <CalendarDays size={15} />;
  if (type === "url") return <Link2 size={15} />;
  if (type === "select") return <List size={15} />;
  if (type === "multiSelect") return <ListChecks size={15} />;
  if (type === "tags") return <Tags size={15} />;
  return <Type size={15} />;
}
