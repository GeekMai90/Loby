/**
 * [INPUT]: 依赖 React 运行时、lucide-react、shadcn/ui 基础控件、shared 公共契约、写作库模块、写作活动模块
 * [OUTPUT]: 对外提供 WritingActivityPanel
 * [POS]: 写作活动 feature 的界面组合单元，连接写作活动状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { cloneElement, useMemo, useState } from "react";
import { ActivityCalendar, type Activity } from "react-activity-calendar";
import { CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { WritingCheckIn, WritingProject } from "@/shared/types";
import { getProjectInformation } from "@/features/library/model/projectInformation";
import { writingActivityLevel, writingDates, writingStreaks } from "@/features/writing-activity/model/writingGoals";

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
  light: [
    "var(--writing-activity-empty)",
    "var(--writing-activity-light)",
    "var(--writing-activity-medium)",
    "var(--writing-activity-strong)",
  ],
  dark: [
    "var(--writing-activity-empty)",
    "var(--writing-activity-light)",
    "var(--writing-activity-medium)",
    "var(--writing-activity-strong)",
  ],
};
const RECENT_WEEK_COUNT = 14;
const RECENT_BLOCK_SIZE = 16;
const RECENT_BLOCK_MARGIN = 5;
const RECENT_CALENDAR_WIDTH = RECENT_WEEK_COUNT * (RECENT_BLOCK_SIZE + RECENT_BLOCK_MARGIN) - RECENT_BLOCK_MARGIN;

export function WritingActivityPanel({ checkIns, projects }: WritingActivityPanelProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [projectId, setProjectId] = useState("all");
  const [selectedDate, setSelectedDate] = useState("");
  const userProjects = useMemo(
    () => projects.filter((project) => !["inbox-root", "notes-root", "loby-guide"].includes(project.id)),
    [projects],
  );
  const allDates = useMemo(() => writingDates(checkIns), [checkIns]);
  const streaks = useMemo(() => writingStreaks(allDates), [allDates]);
  const recentData = useMemo(() => {
    const today = new Date();
    return calendarData(checkIns, recentCalendarStart(today, RECENT_WEEK_COUNT), today);
  }, [checkIns]);
  const filteredCheckIns = useMemo(
    () => checkIns.filter((item) => projectId === "all" || item.projectId === projectId),
    [checkIns, projectId],
  );
  const filteredDates = useMemo(() => writingDates(filteredCheckIns), [filteredCheckIns]);
  const filteredStreaks = useMemo(() => writingStreaks(filteredDates), [filteredDates]);
  const fullData = useMemo(() => calendarData(filteredCheckIns, addLocalDays(new Date(), -364), new Date()), [filteredCheckIns]);
  const monthPrefix = formatDateKey(new Date()).slice(0, 7);
  const monthDays = filteredDates.filter((date) => date.startsWith(monthPrefix)).length;
  const selectedCheckIns = filteredCheckIns.filter((item) => item.date === selectedDate);
  const articleCount = userProjects.reduce((total, project) => total + getProjectInformation(project).articleCount, 0);
  const filteredProjects = projectId === "all" ? userProjects : userProjects.filter((project) => project.id === projectId);
  const filteredProjectInformation = filteredProjects.reduce(
    (total, project) => {
      const information = getProjectInformation(project);
      return {
        articleCount: total.articleCount + information.articleCount,
        totalWords: total.totalWords + information.totalWords,
      };
    },
    { articleCount: 0, totalWords: 0 },
  );
  const recentMonths = calendarMonthSegments(recentData);

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" surface="transparent" title="写作热力图" aria-label="写作热力图">
            <CalendarCheck className="size-[17px]" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[360px] p-4">
          <div className="grid grid-cols-3 gap-3">
            <SummaryMetric
              label="全部文档"
              value={articleCount}
              interactive
              onClick={() => {
                setPopoverOpen(false);
                setDialogOpen(true);
              }}
            />
            <SummaryMetric label="累计天数" value={allDates.length} />
            <SummaryMetric label="连续天数" value={streaks.current} />
          </div>

          <div className="mt-5 flex justify-center pb-1">
            <div className="shrink-0 px-px" style={{ width: RECENT_CALENDAR_WIDTH + 2 }}>
              <ActivityCalendar
                className="writing-activity-recent-calendar"
                data={recentData}
                blockSize={RECENT_BLOCK_SIZE}
                blockMargin={RECENT_BLOCK_MARGIN}
                blockRadius={4}
                fontSize={10}
                maxLevel={3}
                theme={CALENDAR_THEME}
                labels={CALENDAR_LABELS}
                showColorLegend={false}
                showMonthLabels={false}
                showTotalCount={false}
                weekStart={1}
                renderBlock={(block, activity) =>
                  cloneElement(block, {
                    title: `${activity.date} ${activityLevelLabel(activity.level)}`,
                    "aria-label": `${activity.date} ${activityLevelLabel(activity.level)}`,
                  })
                }
              />
              <div
                className="mt-2 grid text-center text-[11px] leading-4 text-muted-foreground"
                style={{ gridTemplateColumns: `repeat(${RECENT_WEEK_COUNT}, minmax(0, 1fr))` }}
                aria-label="热力图月份"
              >
                {recentMonths.map((month) => (
                  <span key={month.key} style={{ gridColumn: `${month.start + 1} / span ${month.span}` }}>
                    {month.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[min(920px,calc(100vw-48px))] max-w-[min(920px,calc(100vw-48px))] gap-5 p-6 sm:max-w-[min(920px,calc(100vw-48px))]">
          <DialogHeader>
            <DialogTitle>写作热力图</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-3 gap-3">
            <Metric label="当前文章数" value={`${filteredProjectInformation.articleCount.toLocaleString("zh-CN")} 篇`} />
            <Metric label="累计字数" value={`${filteredProjectInformation.totalWords.toLocaleString("zh-CN")} 字`} />
            <Metric label="累计写作" value={`${filteredDates.length.toLocaleString("zh-CN")} 天`} />
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
              maxLevel={3}
              theme={CALENDAR_THEME}
              labels={CALENDAR_LABELS}
              showColorLegend={false}
              showWeekdayLabels={["mon", "wed", "fri"]}
              weekStart={1}
              renderBlock={(block, activity) =>
                cloneElement(block, {
                  onClick: activity.count > 0 ? () => setSelectedDate(activity.date) : undefined,
                  className: activity.count > 0 ? "cursor-pointer" : undefined,
                  title: `${activity.date} ${activityLevelLabel(activity.level)}`,
                  "aria-label": `${activity.date} ${activityLevelLabel(activity.level)}`,
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

function SummaryMetric({
  label,
  value,
  interactive = false,
  onClick,
}: {
  label: string;
  value: number;
  interactive?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <>
      <strong className="block text-2xl leading-none font-semibold tracking-tight tabular-nums">{value}</strong>
      <span className="mt-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
    </>
  );

  if (interactive) {
    return (
      <button
        type="button"
        className="min-w-0 cursor-pointer appearance-none border-0 bg-transparent py-2 text-center font-[inherit] text-foreground focus-visible:rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        aria-label="查看全部文档与写作详情"
        title="查看详细写作数据"
        onClick={onClick}
      >
        {content}
      </button>
    );
  }

  return <div className="min-w-0 py-2 text-center">{content}</div>;
}

interface CalendarMonthSegment {
  key: string;
  label: string;
  start: number;
  span: number;
}

function calendarMonthSegments(data: Activity[]): CalendarMonthSegment[] {
  const weeks = Array.from({ length: Math.ceil(data.length / 7) }, (_, index) => data.slice(index * 7, index * 7 + 7));
  const segments: CalendarMonthSegment[] = [];

  weeks.forEach((week, weekIndex) => {
    const representative = week[Math.min(3, week.length - 1)];
    if (!representative) return;
    const [year, month] = representative.date.split("-");
    const key = `${year}-${month}`;
    const current = segments.at(-1);
    if (current?.key === key) {
      current.span += 1;
      return;
    }
    segments.push({ key, label: `${Number(month)}月`, start: weekIndex, span: 1 });
  });

  return segments;
}

function calendarData(checkIns: WritingCheckIn[], start: Date, end: Date): Activity[] {
  const data: Activity[] = [];
  const cursor = startOfLocalDay(start);
  const last = startOfLocalDay(end);
  while (cursor <= last) {
    const date = formatDateKey(cursor);
    const dateCheckIns = checkIns.filter((item) => item.date === date);
    const count = new Set(dateCheckIns.map((item) => item.sheetId)).size;
    data.push({ date, count, level: writingActivityLevel(dateCheckIns, date) });
    cursor.setDate(cursor.getDate() + 1);
  }
  return data;
}

function activityLevelLabel(level: number): string {
  if (level === 3) return "高强度写作";
  if (level === 2) return "完成文章目标";
  if (level === 1) return "已写作";
  return "未写作";
}

function addLocalDays(date: Date, days: number): Date {
  const result = startOfLocalDay(date);
  result.setDate(result.getDate() + days);
  return result;
}

function recentCalendarStart(date: Date, weekCount: number): Date {
  const result = startOfLocalDay(date);
  const daysSinceMonday = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - daysSinceMonday - (weekCount - 1) * 7);
  return result;
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatDateKey(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
