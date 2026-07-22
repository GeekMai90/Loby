/**
 * [INPUT]: 依赖 shadcn/ui 基础控件、date-fns
 * [OUTPUT]: 对外提供 PropertyDateCalendar
 * [POS]: shared 层的跨功能复用的界面基础，不依赖具体 feature
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Calendar } from "@/components/ui/calendar";
import { zhCN } from "date-fns/locale";

export function PropertyDateCalendar({
  selected,
  defaultMonth,
  onSelect,
  className,
}: {
  selected?: Date;
  defaultMonth?: Date;
  onSelect: (date: Date | undefined) => void;
  className?: string;
}) {
  return <Calendar mode="single" locale={zhCN} selected={selected} defaultMonth={defaultMonth} onSelect={onSelect} className={className} />;
}
