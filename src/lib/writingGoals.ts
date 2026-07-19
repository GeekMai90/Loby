import type { ProjectGoal, WritingActivityStore, WritingCheckIn, WritingProject, WritingSheet } from "../types";
import { countWords } from "./text";

const EXCLUDED_CHECK_IN_PROJECT_IDS = new Set(["inbox-root", "notes-root", "loby-guide"]);

export const EMPTY_WRITING_ACTIVITY: WritingActivityStore = {
  version: 1,
  checkIns: [],
  celebratedTargets: {},
};

export function normalizeProjectGoal(project: Pick<WritingProject, "projectGoal" | "targetWords">): ProjectGoal {
  const goal = project.projectGoal;
  if (goal?.enabled && (goal.unit === "words" || goal.unit === "articles")) {
    const target = normalizedGoalTarget(goal.target);
    if (target > 0) return { enabled: true, unit: goal.unit, target };
  }
  const legacyTarget = normalizedGoalTarget(project.targetWords);
  return legacyTarget > 0
    ? { enabled: true, unit: "words", target: legacyTarget }
    : { enabled: false, unit: goal?.unit === "articles" ? "articles" : "words", target: normalizedGoalTarget(goal?.target) };
}

export function projectGoalValue(project: WritingProject): number {
  const goal = normalizeProjectGoal(project);
  if (!goal.enabled) return 0;
  if (goal.unit === "articles") {
    return project.sheets.filter((sheet) => !sheet.archivedAt && sheet.type === "正文" && Boolean(sheet.completedAt)).length;
  }
  return project.sheets
    .filter((sheet) => !sheet.archivedAt && (sheet.type === "正文" || sheet.type === "章节"))
    .reduce((total, sheet) => total + countWords(sheet.body), 0);
}

export function projectGoalProgress(project: WritingProject): number {
  const goal = normalizeProjectGoal(project);
  if (!goal.enabled || goal.target <= 0) return 0;
  return Math.min(100, Math.round((projectGoalValue(project) / goal.target) * 100));
}

export function qualifiesForWritingCheckIn(project: WritingProject, sheet: WritingSheet): boolean {
  if (EXCLUDED_CHECK_IN_PROJECT_IDS.has(project.id)) return false;
  if (sheet.type !== "正文" || !sheet.body.trim()) return false;
  if (!sheet.createdAt || !sheet.updatedAt || sheet.createdAt === sheet.updatedAt) return false;
  return Boolean(checkInDate(sheet));
}

export function deriveWritingCheckIns(projects: WritingProject[], todayKey = formatDateKey(new Date())): WritingCheckIn[] {
  return projects.flatMap((project) =>
    project.sheets.flatMap((sheet) => {
      const date = checkInDate(sheet);
      if (!date || date !== todayKey || !qualifiesForWritingCheckIn(project, sheet)) return [];
      return [
        {
          date,
          projectId: project.id,
          projectTitle: project.title,
          sheetId: sheet.id,
          sheetTitle: sheet.title || "无标题",
        },
      ];
    }),
  );
}

export function mergeWritingCheckIns(current: WritingCheckIn[], derived: WritingCheckIn[]): WritingCheckIn[] {
  const byKey = new Map(current.map((item) => [checkInKey(item), item]));
  for (const item of derived) {
    const key = checkInKey(item);
    const existing = byKey.get(key);
    const next = existing
      ? { ...item, projectTitle: item.projectTitle || existing.projectTitle, sheetTitle: item.sheetTitle || existing.sheetTitle }
      : item;
    byKey.set(
      key,
      existing &&
        existing.date === next.date &&
        existing.projectId === next.projectId &&
        existing.projectTitle === next.projectTitle &&
        existing.sheetId === next.sheetId &&
        existing.sheetTitle === next.sheetTitle
        ? existing
        : next,
    );
  }
  return Array.from(byKey.values()).sort((left, right) => left.date.localeCompare(right.date) || left.sheetId.localeCompare(right.sheetId));
}

export function normalizeWritingActivity(value: unknown): WritingActivityStore {
  if (!value || typeof value !== "object") return { ...EMPTY_WRITING_ACTIVITY };
  const candidate = value as Partial<WritingActivityStore>;
  const checkIns = Array.isArray(candidate.checkIns) ? candidate.checkIns.filter(isWritingCheckIn).map((item) => ({ ...item })) : [];
  const celebratedTargets: Record<string, number[]> = {};
  if (candidate.celebratedTargets && typeof candidate.celebratedTargets === "object") {
    for (const [sheetId, targets] of Object.entries(candidate.celebratedTargets)) {
      if (!sheetId || !Array.isArray(targets)) continue;
      celebratedTargets[sheetId] = Array.from(new Set(targets.map(normalizedGoalTarget).filter((target) => target > 0))).sort(
        (left, right) => left - right,
      );
    }
  }
  return { version: 1, checkIns: mergeWritingCheckIns([], checkIns), celebratedTargets };
}

export function writingDates(checkIns: WritingCheckIn[], projectId?: string): string[] {
  return Array.from(new Set(checkIns.filter((item) => !projectId || item.projectId === projectId).map((item) => item.date))).sort();
}

export function writingStreaks(dates: string[], today: Date = new Date()): { current: number; longest: number } {
  const uniqueDates = Array.from(new Set(dates.filter(isDateKey))).sort();
  let longest = 0;
  let run = 0;
  let previous: Date | null = null;
  for (const date of uniqueDates) {
    const parsed = parseDateKey(date);
    if (!parsed) continue;
    run = previous && dayDifference(previous, parsed) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = parsed;
  }

  const dateSet = new Set(uniqueDates);
  const cursor = startOfLocalDay(today);
  if (!dateSet.has(formatDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let current = 0;
  while (dateSet.has(formatDateKey(cursor))) {
    current += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return { current, longest };
}

export function hasCelebratedTarget(activity: WritingActivityStore, sheetId: string, target: number): boolean {
  return activity.celebratedTargets[sheetId]?.includes(normalizedGoalTarget(target)) ?? false;
}

export function withCelebratedTarget(activity: WritingActivityStore, sheetId: string, target: number): WritingActivityStore {
  const normalizedTarget = normalizedGoalTarget(target);
  if (!sheetId || normalizedTarget <= 0 || hasCelebratedTarget(activity, sheetId, normalizedTarget)) return activity;
  return {
    ...activity,
    celebratedTargets: {
      ...activity.celebratedTargets,
      [sheetId]: [...(activity.celebratedTargets[sheetId] ?? []), normalizedTarget].sort((left, right) => left - right),
    },
  };
}

function checkInDate(sheet: WritingSheet): string {
  const date = sheet.createdAt?.slice(0, 10) ?? "";
  return isDateKey(date) ? date : "";
}

function isWritingCheckIn(value: unknown): value is WritingCheckIn {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<WritingCheckIn>;
  return (
    isDateKey(item.date ?? "") &&
    typeof item.projectId === "string" &&
    Boolean(item.projectId) &&
    typeof item.projectTitle === "string" &&
    typeof item.sheetId === "string" &&
    Boolean(item.sheetId) &&
    typeof item.sheetTitle === "string"
  );
}

function checkInKey(item: Pick<WritingCheckIn, "date" | "sheetId">): string {
  return `${item.date}:${item.sheetId}`;
}

function normalizedGoalTarget(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function isDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return formatDateKey(parseDateKey(value) ?? new Date(0)) === value;
}

function parseDateKey(value: string): Date | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateKey(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dayDifference(left: Date, right: Date): number {
  const leftUtc = Date.UTC(left.getFullYear(), left.getMonth(), left.getDate());
  const rightUtc = Date.UTC(right.getFullYear(), right.getMonth(), right.getDate());
  return Math.round((rightUtc - leftUtc) / 86_400_000);
}
