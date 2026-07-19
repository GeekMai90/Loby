import { cloneElement, useMemo, useState } from "react";
import { ActivityCalendar, type Activity } from "react-activity-calendar";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { WritingCheckIn, WritingProject } from "../types";
import { writingDates, writingStreaks } from "../lib/writingGoals";

interface WritingActivityPanelProps {
  checkIns: WritingCheckIn[];
  projects: WritingProject[];
}

const CALENDAR_LABELS = {
  months: ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"],
  weekdays: ["日", "一", "二", "三", "四", "五", "六"],
  totalCount: "过去一年写作 {{count}} 天",
  legend: { less: "未写", more: "已写" },
};
const CALENDAR_THEME = {
  light: ["var(--muted)", "var(--primary)"],
  dark: ["var(--muted)", "var(--primary)"],
};

export function WritingActivityPanel({ checkIns, projects }: WritingActivityPanelProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [projectId, setProjectId] = useState("all");
  const [selectedDate, setSelectedDate] = useState("");
  const allDates = useMemo(() => writingDates(checkIns), [checkIns]);
  const streaks = useMemo(() => writingStreaks(allDates), [allDates]);
  const recentData = useMemo(() => calendarData(allDates, addLocalDays(new Date(), -83), new Date()), [allDates]);
  const filteredCheckIns = useMemo(
    () => checkIns.filter((item) => projectId === "all" || item.projectId === projectId),
    [checkIns, projectId],
  );
  const filteredDates = useMemo(() => writingDates(filteredCheckIns), [filteredCheckIns]);
  const filteredStreaks = useMemo(() => writingStreaks(filteredDates), [filteredDates]);
  const fullData = useMemo(() => calendarData(filteredDates, addLocalDays(new Date(), -364), new Date()), [filteredDates]);
  const monthPrefix = formatDateKey(new Date()).slice(0, 7);
  const monthDays = filteredDates.filter((date) => date.startsWith(monthPrefix)).length;
  const selectedCheckIns = filteredCheckIns.filter((item) => item.date === selectedDate);
  const userProjects = projects.filter((project) => !["inbox-root", "notes-root", "loby-guide"].includes(project.id));

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" title="写作热力图" aria-label="写作热力图">
            <CalendarDays className="size-[17px]" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">每日写作</p>
              <p className="mt-1 text-xs text-muted-foreground">当天新建并写入正文文章，即完成打卡。</p>
            </div>
            <div className="shrink-0 text-right">
              <strong className="text-lg leading-none tabular-nums">{streaks.current}</strong>
              <p className="mt-1 text-[10px] text-muted-foreground">连续天数</p>
            </div>
          </div>
          <div className="overflow-x-auto pb-1">
            <ActivityCalendar
              data={recentData}
              blockSize={12}
              blockMargin={3}
              blockRadius={3}
              fontSize={10}
              maxLevel={1}
              theme={CALENDAR_THEME}
              labels={CALENDAR_LABELS}
              showColorLegend={false}
              showMonthLabels={false}
              showTotalCount={false}
              weekStart={1}
            />
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
            <span className="text-xs text-muted-foreground">近 12 周写作 {recentData.filter((day) => day.count > 0).length} 天</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setPopoverOpen(false);
                setDialogOpen(true);
              }}
            >
              查看更多
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[min(920px,calc(100vw-48px))] max-w-[min(920px,calc(100vw-48px))] gap-5 p-6 sm:max-w-[min(920px,calc(100vw-48px))]">
          <DialogHeader>
            <DialogTitle>写作热力图</DialogTitle>
            <DialogDescription>按文章创建日记录打卡；只统计当天新建且已有正文内容的文章。</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-3 gap-3">
            <Metric label="当前连续" value={`${filteredStreaks.current} 天`} />
            <Metric label="最长连续" value={`${filteredStreaks.longest} 天`} />
            <Metric label="本月写作" value={`${monthDays} 天`} />
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">过去一年</p>
            <Select
              value={projectId}
              onValueChange={(value) => {
                setProjectId(value);
                setSelectedDate("");
              }}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部项目</SelectItem>
                {userProjects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border bg-card p-4">
            <ActivityCalendar
              data={fullData}
              blockSize={12}
              blockMargin={3}
              blockRadius={3}
              fontSize={11}
              maxLevel={1}
              theme={CALENDAR_THEME}
              labels={CALENDAR_LABELS}
              showColorLegend={false}
              showWeekdayLabels={["mon", "wed", "fri"]}
              weekStart={1}
              renderBlock={(block, activity) =>
                cloneElement(block, {
                  onClick: activity.count > 0 ? () => setSelectedDate(activity.date) : undefined,
                  className: activity.count > 0 ? "cursor-pointer" : undefined,
                  "aria-label": activity.count > 0 ? `${activity.date} 已完成写作打卡` : `${activity.date} 未写作`,
                })
              }
            />
          </div>

          {selectedDate && (
            <div className="rounded-xl border border-border bg-muted/35 p-4">
              <p className="text-sm font-semibold">{selectedDate} 的写作</p>
              {selectedCheckIns.length > 0 ? (
                <ul className="mt-2 space-y-1.5 text-sm">
                  {selectedCheckIns.map((item) => (
                    <li key={`${item.date}:${item.sheetId}`} className="flex items-center justify-between gap-3">
                      <span className="truncate">{item.sheetTitle}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{item.projectTitle}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">这一天没有写作记录。</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function calendarData(dates: string[], start: Date, end: Date): Activity[] {
  const active = new Set(dates);
  const data: Activity[] = [];
  const cursor = startOfLocalDay(start);
  const last = startOfLocalDay(end);
  while (cursor <= last) {
    const date = formatDateKey(cursor);
    const count = active.has(date) ? 1 : 0;
    data.push({ date, count, level: count });
    cursor.setDate(cursor.getDate() + 1);
  }
  return data;
}

function addLocalDays(date: Date, days: number): Date {
  const result = startOfLocalDay(date);
  result.setDate(result.getDate() + days);
  return result;
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatDateKey(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
