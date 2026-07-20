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
